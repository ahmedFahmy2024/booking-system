import { z } from 'zod'

export interface Seat {
  id: string
  rowLabel: string
  seatNumber: number
  aisleAfter: boolean
  isOutOfService: boolean
}

export interface Auditorium {
  id: string
  name: string
  seats: Seat[]
}

export type SeatInput = Omit<Seat, 'id'>

export interface AuditoriumInput {
  name: string
  seats: SeatInput[]
}

/** Row labels are stored uppercase; the unique index is case-sensitive. */
export function normalizeRowLabel(value: string): string {
  return value.trim().toUpperCase()
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

export interface SeatDraft {
  seatNumber: number
  aisleAfter: boolean
  isOutOfService: boolean
}

export interface RowDraft {
  rowLabel: string
  seats: SeatDraft[]
}

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
  seatNumber: z.number().int().positive(),
  aisleAfter: z.boolean(),
  isOutOfService: z.boolean(),
})

const rowDraftSchema = z.object({
  rowLabel: z.string().trim().min(1).max(10),
  seats: z.array(seatDraftSchema),
})

export const auditoriumFormSchema = z
  .object({
    name: z.string().trim().min(1),
    rows: z.array(rowDraftSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const labels = new Set<string>()
    value.rows.forEach((row, rowIndex) => {
      const label = normalizeRowLabel(row.rowLabel)
      if (labels.has(label)) {
        ctx.addIssue({
          code: 'custom',
          message: 'duplicate_row',
          path: ['rows', rowIndex, 'rowLabel'],
        })
      }
      labels.add(label)

      const numbers = new Set<number>()
      row.seats.forEach((seat, seatIndex) => {
        if (numbers.has(seat.seatNumber)) {
          ctx.addIssue({
            code: 'custom',
            message: 'duplicate_seat',
            path: ['rows', rowIndex, 'seats', seatIndex, 'seatNumber'],
          })
        }
        numbers.add(seat.seatNumber)
      })
    })
  })

export type AuditoriumFormValues = z.input<typeof auditoriumFormSchema>
export type AuditoriumFormOutput = z.output<typeof auditoriumFormSchema>

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

export function toAuditoriumInput(values: AuditoriumFormOutput): AuditoriumInput {
  return {
    name: values.name,
    seats: values.rows.flatMap((row) =>
      row.seats.map((seat) => ({
        rowLabel: normalizeRowLabel(row.rowLabel),
        seatNumber: seat.seatNumber,
        aisleAfter: seat.aisleAfter,
        isOutOfService: seat.isOutOfService,
      })),
    ),
  }
}
