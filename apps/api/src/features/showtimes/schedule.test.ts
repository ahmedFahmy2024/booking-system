import { describe, expect, it } from 'vitest'
import {
  bookingCutoffAt,
  cairoWallClockToInstant,
  guestCancellationCutoffAt,
  isBookingClosed,
  isGuestCancellationClosed,
  isSeatAvailable,
  occupancyOf,
  schedulesOverlap,
  SHOWTIME_TURNAROUND_MINUTES,
} from './schedule.js'

const at = (iso: string) => new Date(iso)

describe('cairoWallClockToInstant', () => {
  it('resolves a winter Cairo wall clock at UTC+2', () => {
    expect(cairoWallClockToInstant({ date: '2026-01-15', time: '19:00' }).toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    )
  })

  it('resolves a summer Cairo wall clock at UTC+3', () => {
    expect(cairoWallClockToInstant({ date: '2026-07-15', time: '19:00' }).toISOString()).toBe(
      '2026-07-15T16:00:00.000Z',
    )
  })

  it('resolves a repeated fall-back wall clock to the later occurrence', () => {
    // Egypt repeats 23:00 on 2026-10-29; the helper documents and keeps the
    // later instant so the result is deterministic across environments.
    expect(cairoWallClockToInstant({ date: '2026-10-29', time: '23:00' }).toISOString()).toBe(
      '2026-10-29T21:00:00.000Z',
    )
  })

  it('rejects malformed or impossible wall clocks instead of storing a wrong instant', () => {
    expect(() => cairoWallClockToInstant({ date: '2026-1-15', time: '19:00' })).toThrow(RangeError)
    expect(() => cairoWallClockToInstant({ date: '2026-02-30', time: '19:00' })).toThrow(RangeError)
    // Egypt springs forward at midnight on 2026-04-24; 00:30 does not exist.
    expect(() => cairoWallClockToInstant({ date: '2026-04-24', time: '00:30' })).toThrow(RangeError)
  })
})

describe('auditorium occupancy', () => {
  it('occupies the auditorium for the film duration plus a 15-minute turnaround', () => {
    const interval = occupancyOf({ startsAt: at('2026-01-15T17:00:00Z'), durationMinutes: 120 })
    expect(interval.endsAt.toISOString()).toBe('2026-01-15T19:15:00.000Z')
    expect(SHOWTIME_TURNAROUND_MINUTES).toBe(15)
  })

  it('allows the next showtime to start exactly when the occupancy interval ends', () => {
    const first = { startsAt: at('2026-01-15T17:00:00Z'), durationMinutes: 120 }
    const second = { startsAt: at('2026-01-15T19:15:00Z'), durationMinutes: 90 }
    expect(schedulesOverlap(first, second)).toBe(false)
    expect(schedulesOverlap(second, first)).toBe(false)
  })

  it('rejects a showtime one minute before the previous turnaround ends', () => {
    const first = { startsAt: at('2026-01-15T17:00:00Z'), durationMinutes: 120 }
    const second = { startsAt: at('2026-01-15T19:14:00Z'), durationMinutes: 90 }
    expect(schedulesOverlap(first, second)).toBe(true)
    expect(schedulesOverlap(second, first)).toBe(true)
  })

  it('rejects true overlaps and accepts separated intervals symmetrically', () => {
    const first = { startsAt: at('2026-01-15T17:00:00Z'), durationMinutes: 120 }
    const overlap = { startsAt: at('2026-01-15T18:00:00Z'), durationMinutes: 120 }
    const later = { startsAt: at('2026-01-15T22:00:00Z'), durationMinutes: 120 }
    expect(schedulesOverlap(first, overlap)).toBe(true)
    expect(schedulesOverlap(overlap, first)).toBe(true)
    expect(schedulesOverlap(first, later)).toBe(false)
  })

  it('rejects invalid durations and turnarounds', () => {
    expect(() => occupancyOf({ startsAt: at('2026-01-15T17:00:00Z'), durationMinutes: 0 })).toThrow(
      RangeError,
    )
    expect(
      () => occupancyOf({ startsAt: at('2026-01-15T17:00:00Z'), durationMinutes: 120 }, -1),
    ).toThrow(RangeError)
  })
})

describe('booking window and seat availability', () => {
  const startsAt = at('2026-12-01T10:00:00Z')

  it('closes booking at the exact cutoff and accepts one millisecond before it', () => {
    const cutoff = bookingCutoffAt(startsAt)
    expect(cutoff.toISOString()).toBe('2026-12-01T09:45:00.000Z')
    expect(isBookingClosed(startsAt, new Date(cutoff.getTime() - 1))).toBe(false)
    expect(isBookingClosed(startsAt, cutoff)).toBe(true)
    expect(isBookingClosed(startsAt, new Date(cutoff.getTime() + 1))).toBe(true)
  })

  it('closes guest cancellation at the exact two-hour instant', () => {
    const cutoff = guestCancellationCutoffAt(startsAt)
    expect(cutoff.toISOString()).toBe('2026-12-01T08:00:00.000Z')
    expect(isGuestCancellationClosed(startsAt, new Date(cutoff.getTime() - 1))).toBe(false)
    expect(isGuestCancellationClosed(startsAt, cutoff)).toBe(true)
    expect(isGuestCancellationClosed(startsAt, new Date(cutoff.getTime() + 1))).toBe(true)
  })

  it('keeps the two-hour guest cutoff distinct from the 15-minute checkout cutoff', () => {
    expect(guestCancellationCutoffAt(startsAt).getTime()).toBeLessThan(
      bookingCutoffAt(startsAt).getTime(),
    )
  })

  it('derives availability from the out-of-service flag and the claim set', () => {
    const claimed = new Set(['seat-2'])
    expect(isSeatAvailable({ id: 'seat-1', outOfService: false }, claimed)).toBe(true)
    expect(isSeatAvailable({ id: 'seat-2', outOfService: false }, claimed)).toBe(false)
    expect(isSeatAvailable({ id: 'seat-3', outOfService: true }, claimed)).toBe(false)
  })
})
