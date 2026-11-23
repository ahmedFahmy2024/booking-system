import { normalizeRowLabel } from '@booking-system/cinema-contracts'
import { describe, expect, it } from 'vitest'
import {
  auditoriumFormSchema,
  defaultRow,
  nextRowLabel,
} from './auditorium'

describe('auditorium form model', () => {
  it('normalises row labels and generates spreadsheet-style labels', () => {
    expect(normalizeRowLabel(' a ')).toBe('A')
    expect(nextRowLabel(0)).toBe('A')
    expect(nextRowLabel(25)).toBe('Z')
    expect(nextRowLabel(26)).toBe('AA')
    expect(defaultRow('B', 2).seats.map((seat) => seat.seatNumber)).toEqual([1, 2])
  })

  it('flattens rows into normalised, numbered seats', () => {
    const parsed = auditoriumFormSchema.parse({
      name: 'Main Hall',
      rows: [
        {
          rowLabel: ' a ',
          seats: [{ seatNumber: 1, aisleAfter: true, isOutOfService: false }],
        },
      ],
    })
    expect(parsed).toEqual({
      name: 'Main Hall',
      seats: [{ rowLabel: 'A', seatNumber: 1, aisleAfter: true, isOutOfService: false }],
    })
  })

  it('checks the uppercase row label length at the form field', () => {
    const result = auditoriumFormSchema.safeParse({
      name: 'Hall',
      rows: [defaultRow('ß'.repeat(6), 1)],
    })
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['rows', 0, 'rowLabel'] }),
    )
  })

  it('refuses duplicate rows and duplicate seat numbers', () => {
    const row = { rowLabel: 'A', seats: [{ seatNumber: 1, aisleAfter: false, isOutOfService: false }] }
    expect(
      auditoriumFormSchema.safeParse({ name: 'Hall', rows: [row, { ...row, rowLabel: 'a' }] })
        .success,
    ).toBe(false)
    const duplicateSeat = auditoriumFormSchema.safeParse({
      name: 'Hall',
      rows: [row, { rowLabel: 'B', seats: [row.seats[0], row.seats[0]] }],
    })
    expect(duplicateSeat.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ['rows', 1, 'seats', 1, 'seatNumber'],
        message: 'duplicate_seat',
      }),
    )
  })

  it('validates the 2000-seat limit across all rows', () => {
    const first = defaultRow('A', 1000)
    const atLimit = { name: 'Hall', rows: [first, defaultRow('B', 1000)] }
    expect(auditoriumFormSchema.safeParse(atLimit).success).toBe(true)

    const overLimit = { name: 'Hall', rows: [first, defaultRow('B', 1001)] }
    const result = auditoriumFormSchema.safeParse(overLimit)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: ['rows'], message: 'seat_limit' }),
    )
  })
})
