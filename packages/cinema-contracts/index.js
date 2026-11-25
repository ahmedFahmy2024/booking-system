import { z } from 'zod'

export const filmWriteSchema = z.object({
  title: z.string().trim().min(1),
  durationMinutes: z.number().int().positive(),
  synopsis: z.string().trim().min(1),
  posterUrl: z.string().trim().nullish()
    .transform((value) => value || null)
    .pipe(z.url().nullable()),
})

export const MAX_AUDITORIUM_SEATS = 2000
export const MAX_ROW_LABEL_LENGTH = 10

/** @param {string} value */
export function normalizeRowLabel(value) {
  return value.trim().toUpperCase()
}

export const rowLabelSchema = z.string().transform(normalizeRowLabel)
  .pipe(z.string().min(1).max(MAX_ROW_LABEL_LENGTH))

const seatWriteSchema = z.object({
  rowLabel: rowLabelSchema,
  seatNumber: z.number().int().positive(),
  aisleAfter: z.boolean().default(false),
  isOutOfService: z.boolean().default(false),
})

export const auditoriumWriteSchema = z.object({
  name: z.string().trim().min(1),
  seats: z.array(seatWriteSchema).max(MAX_AUDITORIUM_SEATS, { error: 'seat_limit' })
    .superRefine((seats, ctx) => {
      const seen = new Set()
      seats.forEach((seat, index) => {
        const key = `${seat.rowLabel}#${seat.seatNumber}`
        if (seen.has(key)) {
          ctx.addIssue({
            code: 'custom',
            message: 'duplicate_seat',
            path: [index, 'seatNumber'],
          })
        }
        seen.add(key)
      })
    }),
})

/** Cinema-wide default; raise or lower this value to reconfigure checkout. */
export const MAX_BOOKING_SEATS = 6

/**
 * The request the guest checkout form builds and the confirmation API accepts.
 * Seat claims themselves are enforced on the server at confirmation, so this
 * schema only describes the shape and the cinema-wide seat limit.
 */
export const checkoutRequestSchema = z.object({
  showtimeId: z.uuid(),
  seatIds: z.array(z.uuid())
    .min(1, { error: 'no_seat_selected' })
    .max(MAX_BOOKING_SEATS, { error: 'seat_limit' })
    .superRefine((seatIds, ctx) => {
      const seen = new Set()
      seatIds.forEach((id, index) => {
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: 'duplicate_seat',
            path: [index],
          })
        }
        seen.add(id)
      })
    }),
  customerEmail: z.email(),
})

/**
 * The write payload adds the unit price the guest actually reviewed. Omitting
 * it keeps the older client behavior (book at the server's current price);
 * sending it makes a price change a conflict the guest must acknowledge.
 */
export const checkoutConfirmationSchema = checkoutRequestSchema.extend({
  quotedUnitPricePiastres: z.number().int().positive().optional(),
})

/** Conflict details returned with a price or availability failure. */
export const checkoutConflictSchema = z.object({
  error: z.enum(['seat_unavailable', 'price_changed']),
  unitPricePiastres: z.number().int().positive(),
  availableSeatIds: z.array(z.uuid()),
})

/**
 * D4: a stable key travels in a header, separate from the request body so the
 * payload fingerprint can describe only what the guest actually confirmed.
 */
export const idempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.uuid(),
})

/**
 * Deterministic description of one confirmation attempt. Both sides use it:
 * the API stores a SHA-256 fingerprint and the web rotates its key when the
 * payload changes. Property order and seat order are significant because the
 * replayed confirmation shows the seat labels in the requested order.
 *
 * @param {{ showtimeId: string, seatIds: string[], customerEmail: string, quotedUnitPricePiastres?: number }} input
 */
export function canonicalCheckoutPayload(input) {
  return JSON.stringify({
    showtimeId: input.showtimeId,
    seatIds: [...input.seatIds],
    customerEmail: input.customerEmail,
    quotedUnitPricePiastres: input.quotedUnitPricePiastres ?? null,
  })
}
