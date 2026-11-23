import { describe, expect, it } from 'vitest'
import {
  auditoriumFormSchema,
  defaultRow,
  filmFormSchema,
  nextRowLabel,
  normalizeRowLabel,
  toAuditoriumInput,
} from './cinema'

describe('cinema admin form model', () => {
  it('normalises row labels and generates spreadsheet-style labels', () => {
    expect(normalizeRowLabel(' a ')).toBe('A')
    expect(nextRowLabel(0)).toBe('A')
    expect(nextRowLabel(25)).toBe('Z')
    expect(nextRowLabel(26)).toBe('AA')
    expect(defaultRow('B', 2).seats.map((seat) => seat.seatNumber)).toEqual([1, 2])
  })

  it('parses the film form into API-shaped values', () => {
    const parsed = filmFormSchema.parse({
      title: 'Cairo Nights',
      durationMinutes: '120',
      synopsis: 'A story.',
      posterUrl: '',
    })
    expect(parsed.durationMinutes).toBe(120)
    expect(parsed.posterUrl).toBeNull()
    expect(filmFormSchema.safeParse({ ...parsed, durationMinutes: '0' }).success).toBe(false)
    expect(
      filmFormSchema.safeParse({ ...parsed, posterUrl: 'not-a-url' }).success,
    ).toBe(false)
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
    expect(toAuditoriumInput(parsed)).toEqual({
      name: 'Main Hall',
      seats: [{ rowLabel: 'A', seatNumber: 1, aisleAfter: true, isOutOfService: false }],
    })
  })

  it('refuses duplicate rows and duplicate seat numbers', () => {
    const row = { rowLabel: 'A', seats: [{ seatNumber: 1, aisleAfter: false, isOutOfService: false }] }
    expect(
      auditoriumFormSchema.safeParse({ name: 'Hall', rows: [row, { ...row, rowLabel: 'a' }] })
        .success,
    ).toBe(false)
    expect(
      auditoriumFormSchema.safeParse({
        name: 'Hall',
        rows: [{ rowLabel: 'A', seats: [row.seats[0], row.seats[0]] }],
      }).success,
    ).toBe(false)
  })
})
