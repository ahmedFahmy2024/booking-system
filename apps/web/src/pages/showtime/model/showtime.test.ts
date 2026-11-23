import { describe, expect, it } from 'vitest'
import { seatLabel, seatsByRow, type Seat } from './showtime'

const seat = (overrides: Partial<Seat> = {}): Seat => ({
  id: 'seat-1',
  rowLabel: 'A',
  seatNumber: 1,
  aisleAfter: false,
  outOfService: false,
  available: true,
  ...overrides,
})

describe('showtime seat model', () => {
  it('builds a seat label from auditorium data', () => {
    expect(seatLabel(seat({ rowLabel: 'B', seatNumber: 12 }))).toBe('B12')
  })

  it('groups seats by row label in the order they appear', () => {
    const rows = seatsByRow([
      seat(),
      seat({ id: 'seat-3', seatNumber: 3 }),
      seat({ id: 'seat-b1', rowLabel: 'B', seatNumber: 1 }),
    ])

    expect(rows.map((row) => row.rowLabel)).toEqual(['A', 'B'])
    expect(rows[0].seats.map((item) => item.id)).toEqual(['seat-1', 'seat-3'])
    expect(rows[1].seats).toHaveLength(1)
  })
})
