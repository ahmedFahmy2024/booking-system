import { auditoriumWriteSchema, rowLabelSchema } from '@booking-system/cinema-contracts'
import { z } from 'zod'

export type AuditoriumInput = z.output<typeof auditoriumWriteSchema>
export type Seat = AuditoriumInput['seats'][number] & { id: string }

export interface Auditorium {
  id: string
  name: string
  seats: Seat[]
}

/** A, B, … Z, AA, AB … for newly added rows. */
export function nextRowLabel(index: number): string {
  let n = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

export const DEFAULT_SEATS_PER_ROW = 10
type RowDraft = AuditoriumFormValues['rows'][number]
type SeatDraft = RowDraft['seats'][number]

export function defaultRow(rowLabel: string, seatCount = DEFAULT_SEATS_PER_ROW): RowDraft {
  return {
    rowLabel,
    seats: Array.from({ length: seatCount }, (_, index) => ({
      seatNumber: index + 1,
      aisleAfter: false,
      isOutOfService: false,
    })),
  }
}

const seatDraftSchema = z.object({
  seatNumber: z.number(),
  aisleAfter: z.boolean(),
  isOutOfService: z.boolean(),
})

const rowDraftSchema = z.object({
  rowLabel: rowLabelSchema,
  seats: z.array(seatDraftSchema),
})

export const auditoriumFormSchema = z
  .object({
    name: auditoriumWriteSchema.shape.name,
    rows: z.array(rowDraftSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const labels = new Set<string>()
    value.rows.forEach((row, rowIndex) => {
      if (labels.has(row.rowLabel)) {
        ctx.addIssue({
          code: 'custom',
          message: 'duplicate_row',
          path: ['rows', rowIndex, 'rowLabel'],
        })
      }
      labels.add(row.rowLabel)
    })
  })
  .transform(({ name, rows }, ctx) => {
    const entries = rows.flatMap(({ rowLabel, seats }, rowIndex) =>
      seats.map((seat, seatIndex) => ({ seat: { ...seat, rowLabel }, rowIndex, seatIndex })),
    )
    const result = auditoriumWriteSchema.safeParse({ name, seats: entries.map(({ seat }) => seat) })
    if (result.success) return result.data

    for (const issue of result.error.issues) {
      const [field, index, ...seatPath] = issue.path
      if (field !== 'seats') {
        ctx.addIssue({ ...issue })
        continue
      }
      const entry = typeof index === 'number' ? entries[index] : undefined
      ctx.addIssue({
        ...issue,
        path: entry ? ['rows', entry.rowIndex, 'seats', entry.seatIndex, ...seatPath] : ['rows'],
      })
    }
    return z.NEVER
  })

export type AuditoriumFormValues = z.input<typeof auditoriumFormSchema>
export type AuditoriumFormOutput = AuditoriumInput

export function toAuditoriumFormValues(auditorium: Auditorium): AuditoriumFormValues {
  const byLabel = new Map<string, SeatDraft[]>()
  for (const seat of auditorium.seats) {
    const list = byLabel.get(seat.rowLabel) ?? []
    list.push({
      seatNumber: seat.seatNumber,
      aisleAfter: seat.aisleAfter,
      isOutOfService: seat.isOutOfService,
    })
    byLabel.set(seat.rowLabel, list)
  }
  return {
    name: auditorium.name,
    rows: [...byLabel.entries()].map(([rowLabel, seats]) => ({
      rowLabel,
      seats: seats.sort((a, b) => a.seatNumber - b.seatNumber),
    })),
  }
}

export function emptyAuditoriumFormValues(): AuditoriumFormValues {
  return { name: '', rows: [defaultRow('A')] }
}
