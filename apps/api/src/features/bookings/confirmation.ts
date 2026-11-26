import {
  canonicalCheckoutPayload,
  checkoutConfirmationSchema,
  idempotencyKeyHeaderSchema,
  MAX_BOOKING_SEATS,
} from '@booking-system/cinema-contracts'
import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { AuthEnv } from '../../auth/middleware.js'
import { auditoriums, films, showtimes, type AuditoriumLayoutSnapshot } from '../../db/cinema-schema.js'
import { getDb } from '../../db/index.js'
import { bookingSeats, bookings, type StoredConfirmationResponse } from '../../db/schema.js'
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

const IDEMPOTENCY_CONSTRAINT = 'bookings_idempotency_key_unique'

/**
 * Drizzle wraps the Neon driver error; walk the cause chain for the SQLSTATE
 * and keep the constraint name so an idempotency race is not misreported as a
 * competing seat claim. Both constraints can raise 23505. An older driver that
 * exposes no constraint name keeps the historical seat-conflict behavior.
 */
function uniqueViolationConstraint(error: unknown): string | null {
  let current: unknown = error
  while (current instanceof Error) {
    const { code, constraint } = current as Error & { code?: unknown; constraint?: unknown }
    if (code === '23505') return typeof constraint === 'string' ? constraint : ''
    current = current.cause
  }
  return null
}

/**
 * A seat is selectable only when it is in the layout frozen at publish time and
 * the auditorium did not mark it out of service. The label is frozen too (D3):
 * live seat rows are deliberately not consulted, so an auditorium edit cannot
 * rewrite what an existing booking shows on its confirmation screen.
 */
function selectableSeatLabels(snapshot: AuditoriumLayoutSnapshot | null): Map<string, string> {
  const labels = new Map<string, string>()
  if (!snapshot) return labels
  for (const seat of snapshot.seats) {
    if (!seat.outOfService) labels.set(seat.id, `${seat.rowLabel}${seat.seatNumber}`)
  }
  return labels
}

/** Only public fields stored for replay; never a guest-link credential. */
type ReplayRow = {
  customerEmail: string
  idempotencyFingerprint: string | null
  idempotencyResponse: StoredConfirmationResponse | null
}

async function findByConfirmationKey(
  db: ReturnType<typeof getDb>,
  key: string,
): Promise<ReplayRow | undefined> {
  const [row] = await db
    .select({
      customerEmail: bookings.customerEmail,
      idempotencyFingerprint: bookings.idempotencyFingerprint,
      idempotencyResponse: bookings.idempotencyResponse,
    })
    .from(bookings)
    .where(eq(bookings.idempotencyKey, key))
    .limit(1)
  return row
}

type ReplayResult =
  | { kind: 'missing' }
  | { kind: 'conflict' }
  | { kind: 'replay'; response: StoredConfirmationResponse & { customerEmail: string } }

function readReplay(row: ReplayRow | undefined, fingerprint: string): ReplayResult {
  if (!row || !row.idempotencyResponse || !row.idempotencyFingerprint) return { kind: 'missing' }
  if (row.idempotencyFingerprint !== fingerprint) return { kind: 'conflict' }
  return { kind: 'replay', response: publicResponse(row.idempotencyResponse, row.customerEmail) }
}

/**
 * Both the first 201 and its replay build the body in this exact order, so a
 * lost response and its replay are byte-identical even though jsonb normalizes
 * stored object keys. Contact details stay on the booking row only, so D7
 * retention clears them without touching the replay snapshot.
 */
function publicResponse(stored: StoredConfirmationResponse, customerEmail: string) {
  return {
    id: stored.id,
    reference: stored.reference,
    showtimeId: stored.showtimeId,
    filmTitle: stored.filmTitle,
    startsAt: stored.startsAt,
    auditoriumName: stored.auditoriumName,
    seatLabels: stored.seatLabels,
    seatIds: stored.seatIds,
    unitPricePiastres: stored.unitPricePiastres,
    totalPiastres: stored.totalPiastres,
    customerEmail,
  }
}

confirmationRoutes.post(
  '/',
  zValidator('header', idempotencyKeyHeaderSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid_idempotency_key' }, 400)
  }),
  rateLimit('checkout', 30),
  zValidator('json', checkoutConfirmationSchema),
  async (c) => {
    const input = c.req.valid('json')
    const idempotencyKey = c.req.valid('header')['idempotency-key']
    const fingerprint = createHash('sha256').update(canonicalCheckoutPayload(input)).digest('hex')
    const db = getDb()

    // A lost response is replayed before any other work: the original booking
    // and its seat claims already exist and no second email is sent.
    const replay = readReplay(await findByConfirmationKey(db, idempotencyKey), fingerprint)
    if (replay.kind === 'conflict') {
      return c.json({ error: 'idempotency_key_conflict' }, 409)
    }
    if (replay.kind === 'replay') return c.json(replay.response, 201)

    const [showtime] = await db
      .select({
        id: showtimes.id,
        auditoriumId: showtimes.auditoriumId,
        startsAt: showtimes.startsAt,
        status: showtimes.status,
        pricePiastres: showtimes.pricePiastres,
        layoutSnapshot: showtimes.layoutSnapshot,
        filmTitle: films.title,
        auditoriumName: auditoriums.name,
      })
      .from(showtimes)
      .innerJoin(films, eq(films.id, showtimes.filmId))
      .innerJoin(auditoriums, eq(auditoriums.id, showtimes.auditoriumId))
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
    const labels = selectableSeatLabels(snapshot)
    const seatLabels: string[] = []
    for (const id of input.seatIds) {
      const label = labels.get(id)
      if (!label) return c.json({ error: 'invalid_seat' }, 400)
      seatLabels.push(label)
    }
    // D3 freezes the auditorium identity at publish; the live name is only a
    // fallback for older rows without a snapshot name.
    const auditoriumName = snapshot.auditoriumName || showtime.auditoriumName

    // The accepted price is the showtime's published price, never a client value.
    if (showtime.pricePiastres <= 0) return c.json({ error: 'price_unavailable' }, 409)
    if (input.seatIds.length > MAX_BOOKING_SEATS) {
      return c.json({ error: 'seat_limit' }, 400)
    }
    const unitPricePiastres = showtime.pricePiastres
    const totalPiastres = unitPricePiastres * input.seatIds.length

    // Conflict responses carry current details so the guest can keep the seats
    // that are still available and see the price they must explicitly accept.
    const claimRows = await db
      .select({ seatId: bookingSeats.seatId })
      .from(bookingSeats)
      .where(eq(bookingSeats.showtimeId, showtime.id))
    const claimedSeatIds = new Set(claimRows.map((row) => row.seatId))
    const availableSeatIds = input.seatIds.filter((id) => !claimedSeatIds.has(id))

    if (availableSeatIds.length < input.seatIds.length) {
      return c.json({ error: 'seat_unavailable', unitPricePiastres, availableSeatIds }, 409)
    }
    if (
      input.quotedUnitPricePiastres !== undefined &&
      input.quotedUnitPricePiastres !== unitPricePiastres
    ) {
      return c.json({ error: 'price_changed', unitPricePiastres, availableSeatIds }, 409)
    }

    // Generate the id here so both inserts in the atomic batch share it. Neon's
    // HTTP batch sends them as one transaction: a losing seat claim rolls the
    // booking insert back instead of leaving a partial reservation.
    const id = randomUUID()
    const reference = createBookingReference()
    const credential = createGuestCredential()
    const response: StoredConfirmationResponse = {
      id,
      reference,
      showtimeId: showtime.id,
      filmTitle: showtime.filmTitle,
      startsAt: showtime.startsAt.toISOString(),
      auditoriumName,
      seatLabels,
      seatIds: input.seatIds,
      unitPricePiastres,
      totalPiastres,
    }
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
          idempotencyKey,
          idempotencyFingerprint: fingerprint,
          idempotencyResponse: response,
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
      const constraint = uniqueViolationConstraint(error)
      if (constraint === IDEMPOTENCY_CONSTRAINT) {
        // A concurrent attempt with the same key won between the replay read
        // and the write. Return exactly what it stored, without a second email.
        const winner = readReplay(await findByConfirmationKey(db, idempotencyKey), fingerprint)
        if (winner.kind === 'conflict') return c.json({ error: 'idempotency_key_conflict' }, 409)
        if (winner.kind === 'replay') return c.json(winner.response, 201)
        throw error
      }
      if (constraint !== null) {
        // A same-key attempt with a different payload may have committed while
        // this batch lost on a seat constraint. Report the key conflict first
        // so both racing outcomes agree on why the request was refused.
        const keyWinner = readReplay(await findByConfirmationKey(db, idempotencyKey), fingerprint)
        if (keyWinner.kind === 'conflict') {
          return c.json({ error: 'idempotency_key_conflict' }, 409)
        }
        if (keyWinner.kind === 'replay') return c.json(keyWinner.response, 201)
        // A competing claim won between the availability read and the write.
        // Re-read the claims so the conflict names the seats still available.
        const currentClaims = await db
          .select({ seatId: bookingSeats.seatId })
          .from(bookingSeats)
          .where(eq(bookingSeats.showtimeId, showtime.id))
        const current = new Set(currentClaims.map((row) => row.seatId))
        return c.json(
          {
            error: 'seat_unavailable',
            unitPricePiastres,
            availableSeatIds: input.seatIds.filter((id) => !current.has(id)),
          },
          409,
        )
      }
      throw error
    }

    await sendGuestLink(input.customerEmail, reference, credential)
    return c.json(publicResponse(response, input.customerEmail), 201)
  },
)
