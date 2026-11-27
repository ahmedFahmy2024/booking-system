import { and, eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { Hono } from 'hono'
import type { AuthEnv } from '../../auth/middleware.js'
import { getDb } from '../../db/index.js'
import {
  bookingSeats,
  bookings,
  services,
  type BookingStatus,
  type StoredConfirmationResponse,
} from '../../db/schema.js'
import { rateLimit } from '../../rate-limit.js'
import { isGuestCancellationClosed } from '../showtimes/schedule.js'
import { matchesGuestCredential } from './credentials.js'

export const guestRoutes = new Hono<AuthEnv>()

// Generated references are base64url; migrated rows are hex. Both are 32 chars.
const REFERENCE_PATTERN = /^bkg_[A-Za-z0-9_-]{32,64}$/
const GENERIC_DENIAL = { error: 'guest_link_invalid' } as const
/**
 * The write carries the credential in a header rather than the URL: unlike the
 * existing read link, a cancellation should not put the bearer secret in an
 * access log or browser history. The response never reflects it either.
 */
const GUEST_TOKEN_HEADER = 'x-guest-token'

// The private credential lives in the URL and the email, never in a cached
// response or a Referer header sent to another origin. Apply on every branch.
const guestHeaders = createMiddleware<AuthEnv>(async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  await next()
  c.res.headers.set('Cache-Control', 'no-store')
  c.res.headers.set('Referrer-Policy', 'no-referrer')
})

guestRoutes.use('*', guestHeaders, rateLimit('guest-link', 20))

function deny(c: Context<AuthEnv>) {
  return c.json(GENERIC_DENIAL, 404)
}

interface GuestBookingRow {
  id: string
  reference: string
  customerName: string
  customerEmail: string
  startsAt: Date
  serviceName: string | null
  status: BookingStatus
  guestLinkVerifier: string | null
  guestLinkExpiresAt: Date | null
  idempotencyResponse: StoredConfirmationResponse | null
}

/** One lookup shared by the read and the write so both apply the same scope. */
async function readGuestBooking(reference: string): Promise<GuestBookingRow | undefined> {
  const [row] = await getDb()
    .select({
      id: bookings.id,
      reference: bookings.reference,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      startsAt: bookings.startsAt,
      serviceName: services.name,
      status: bookings.status,
      guestLinkVerifier: bookings.guestLinkVerifier,
      guestLinkExpiresAt: bookings.guestLinkExpiresAt,
      // Cinema bookings keep the exact outcome of their confirmation, so a
      // later edit to the film or auditorium cannot rewrite booking history.
      idempotencyResponse: bookings.idempotencyResponse,
    })
    .from(bookings)
    // Cinema bookings have no prototype service; the guest still needs their link.
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.reference, reference))
    .limit(1)
  return row as GuestBookingRow | undefined
}

function bookingStartsAt(row: GuestBookingRow): Date {
  // The frozen confirmation snapshot holds the showtime instant for cinema
  // bookings; prototype rows predate it and keep their stored start time.
  return row.idempotencyResponse ? new Date(row.idempotencyResponse.startsAt) : row.startsAt
}

/**
 * The fixed public field set of the stored outcome, plus the live booking state
 * needed to show whether cancellation is still offered. Only named fields are
 * copied, so a malformed jsonb snapshot cannot leak extra keys.
 */
function detailFor(row: GuestBookingRow) {
  const canCancel = row.status === 'confirmed' && !isGuestCancellationClosed(bookingStartsAt(row))

  if (row.idempotencyResponse) {
    const stored = row.idempotencyResponse
    return {
      id: row.id,
      reference: row.reference,
      showtimeId: stored.showtimeId,
      filmTitle: stored.filmTitle,
      startsAt: stored.startsAt,
      auditoriumName: stored.auditoriumName,
      seatLabels: stored.seatLabels,
      seatIds: stored.seatIds,
      unitPricePiastres: stored.unitPricePiastres,
      totalPiastres: stored.totalPiastres,
      customerEmail: row.customerEmail,
      status: row.status,
      canCancel,
    }
  }

  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    startsAt: row.startsAt,
    serviceName: row.serviceName,
    status: row.status,
    canCancel,
  }
}

guestRoutes.get('/bookings/:reference', async (c) => {
  const token = c.req.query('token')
  const reference = c.req.param('reference')

  // A reference alone is never a credential. Reject before reading the DB so
  // the denial is identical for a missing, invalid or expired token.
  if (!token || !REFERENCE_PATTERN.test(reference)) return deny(c)

  const row = await readGuestBooking(reference)
  if (!row || !matchesGuestCredential(row.guestLinkVerifier, row.guestLinkExpiresAt, token)) {
    return deny(c)
  }

  return c.json(detailFor(row))
})

/**
 * D5: an explicit write through the same private link cancels the whole
 * booking. The status change and the release of every claimed seat happen in
 * one Neon transaction, so a retry can never leave a confirmed booking with
 * free seats or a cancelled booking that still holds them.
 */
guestRoutes.post('/bookings/:reference/cancel', async (c) => {
  const token = c.req.header(GUEST_TOKEN_HEADER)
  const reference = c.req.param('reference')

  if (!token || !REFERENCE_PATTERN.test(reference)) return deny(c)

  const row = await readGuestBooking(reference)
  if (!row || !matchesGuestCredential(row.guestLinkVerifier, row.guestLinkExpiresAt, token)) {
    return deny(c)
  }

  // A repeated or lost-response cancellation is a safe no-op: it reports the
  // cancelled state without a second write or email.
  const cancelledDetail = { ...detailFor(row), status: 'cancelled' as const, canCancel: false }
  if (row.status === 'cancelled') return c.json(cancelledDetail)

  // The cutoff is a closing instant: refused at exactly two hours before the
  // showtime and after it, accepted even one millisecond earlier.
  if (isGuestCancellationClosed(bookingStartsAt(row))) {
    return c.json({ error: 'cancellation_closed' }, 409)
  }

  const db = getDb()
  await db.batch([
    db
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      // Compare and swap: a racing cancellation wins once and the loser still
      // reports the same final state without claiming to have written it.
      .where(and(eq(bookings.id, row.id), eq(bookings.status, 'confirmed'))),
    db.delete(bookingSeats).where(eq(bookingSeats.bookingId, row.id)),
  ])

  return c.json(cancelledDetail)
})
