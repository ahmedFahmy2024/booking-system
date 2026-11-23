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
