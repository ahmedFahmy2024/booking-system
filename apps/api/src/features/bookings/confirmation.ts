import { checkoutRequestSchema, MAX_BOOKING_SEATS } from '@booking-system/cinema-contracts'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { AuthEnv } from '../../auth/middleware.js'
import { showtimes, type AuditoriumLayoutSnapshot } from '../../db/cinema-schema.js'
import { getDb } from '../../db/index.js'
import { bookingSeats, bookings } from '../../db/schema.js'
import { rateLimit } from '../../rate-limit.js'
import {
  createBookingReference,
  createGuestCredential,
  encryptGuestCredential,
  guestLinkExpiresAt,
  guestLinkVerifier,
} from '../guest/credentials.js'
import { isBookingClosed } from '../showtimes/schedule.js'
import { sendGuestLink } from './guest-link.js'

/** The public cinema confirmation write, mounted at /bookings/confirm. */
export const confirmationRoutes = new Hono<AuthEnv>()

/** Drizzle wraps the Neon driver error; walk the cause chain for the SQLSTATE. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if ((current as Error & { code?: unknown }).code === '23505') return true
    current = current.cause
  }
  return false
}

/**
 * A seat is selectable only when it is in the layout frozen at publish time and
 * the auditorium did not mark it out of service. Live seat rows are deliberately
 * not consulted: D3 freezes labels for a showtime that already has bookings.
 */
function selectableSeatIds(snapshot: AuditoriumLayoutSnapshot | null): Set<string> {
  if (!snapshot) return new Set()
  return new Set(snapshot.seats.filter((seat) => !seat.outOfService).map((seat) => seat.id))
}

confirmationRoutes.post(
  '/',
  rateLimit('checkout', 30),
  zValidator('json', checkoutRequestSchema),
  async (c) => {
    const input = c.req.valid('json')
    const db = getDb()

    const [showtime] = await db
      .select({
        id: showtimes.id,
        auditoriumId: showtimes.auditoriumId,
        startsAt: showtimes.startsAt,
        status: showtimes.status,
        pricePiastres: showtimes.pricePiastres,
        layoutSnapshot: showtimes.layoutSnapshot,
      })
      .from(showtimes)
      .where(eq(showtimes.id, input.showtimeId))
      .limit(1)

    // Public reads use the same generic denial for unknown and unpublished ids.
    if (!showtime || showtime.status !== 'published') {
      return c.json({ error: 'showtime_not_found' }, 404)
    }
    if (isBookingClosed(showtime.startsAt)) return c.json({ error: 'booking_closed' }, 409)

    const snapshot = showtime.layoutSnapshot
    if (!snapshot || snapshot.auditoriumId !== showtime.auditoriumId) {
      return c.json({ error: 'seat_map_unavailable' }, 409)
    }
    const selectable = selectableSeatIds(snapshot)
    if (input.seatIds.some((id) => !selectable.has(id))) {
      return c.json({ error: 'invalid_seat' }, 400)
    }

    // The accepted price is the showtime's published price, never a client value.
    if (showtime.pricePiastres <= 0) return c.json({ error: 'price_unavailable' }, 409)
    if (input.seatIds.length > MAX_BOOKING_SEATS) {
      return c.json({ error: 'seat_limit' }, 400)
    }
    const unitPricePiastres = showtime.pricePiastres
    const totalPiastres = unitPricePiastres * input.seatIds.length

    // Generate the id here so both inserts in the atomic batch share it. Neon's
    // HTTP batch sends them as one transaction: a losing seat claim rolls the
    // booking insert back instead of leaving a partial reservation.
    const id = randomUUID()
    const reference = createBookingReference()
    const credential = createGuestCredential()
    try {
      await db.batch([
        db.insert(bookings).values({
          id,
          // Guest checkout collects only an email; it is the customer's display
          // identity until B5 adds a separate name to the guest journey.
          customerName: input.customerEmail,
          customerEmail: input.customerEmail,
          startsAt: showtime.startsAt,
          showtimeId: showtime.id,
          reference,
          guestLinkVerifier: guestLinkVerifier(credential),
          guestLinkEncrypted: encryptGuestCredential(credential),
          guestLinkExpiresAt: guestLinkExpiresAt(showtime.startsAt),
          unitPricePiastres,
          totalPiastres,
        }),
        db.insert(bookingSeats).values(
          input.seatIds.map((seatId) => ({
            bookingId: id,
            showtimeId: showtime.id,
            seatId,
          })),
        ),
      ])
    } catch (error) {
      if (isUniqueViolation(error)) return c.json({ error: 'seat_unavailable' }, 409)
      throw error
    }

    await sendGuestLink(input.customerEmail, reference, credential)
    return c.json(
      {
        id,
        reference,
        showtimeId: showtime.id,
        seatIds: input.seatIds,
        customerEmail: input.customerEmail,
        startsAt: showtime.startsAt.toISOString(),
        unitPricePiastres,
        totalPiastres,
      },
      201,
    )
  },
)
