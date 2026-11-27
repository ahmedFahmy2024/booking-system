/**
 * Pure Cairo scheduling and auditorium-occupancy calculations for B3.1.
 * Enforcement in Postgres, pricing and publish routes belong to B3.3.
 */

export const CAIRO_TIME_ZONE = 'Africa/Cairo'
/** An auditorium is occupied for the film plus this turnaround after it ends. */
export const SHOWTIME_TURNAROUND_MINUTES = 15
/** Online checkout and the read-side booking flag close 15 minutes before start. */
export const BOOKING_CUTOFF_MINUTES = 15

const MINUTE_MS = 60_000
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

export interface CairoWallClock {
  /** Cairo calendar date, `YYYY-MM-DD`. */
  date: string
  /** Cairo 24-hour clock, `HH:mm`. */
  time: string
}

export interface OccupancyInterval {
  startsAt: Date
  /** Exclusive: another showtime may start at exactly this instant. */
  endsAt: Date
}

export interface ShowtimeSchedule {
  startsAt: Date
  durationMinutes: number
}

function localParts(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = new Map(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.get('year')),
    month: Number(parts.get('month')),
    day: Number(parts.get('day')),
    hour: Number(parts.get('hour')),
    minute: Number(parts.get('minute')),
  }
}

/**
 * Resolve a Cairo wall-clock entry to the absolute instant stored in
 * `showtimes.starts_at`. The offset is looked up at the target instant, so
 * Egypt's DST (UTC+2 in winter, UTC+3 in summer) is handled without a
 * hard-coded offset. A repeated fall-back wall clock resolves to the later
 * occurrence; B3.3 may choose a different policy for that one night. A wall
 * time inside the spring-forward gap is rejected rather than silently stored
 * as the wrong instant.
 */
export function cairoWallClockToInstant(
  wallClock: CairoWallClock,
  timeZone: string = CAIRO_TIME_ZONE,
): Date {
  const match = WALL_CLOCK.exec(`${wallClock.date}T${wallClock.time}`)
  if (!match) {
    throw new RangeError('Cairo wall clock must be YYYY-MM-DD and HH:mm')
  }

  const [, year, month, day, hour, minute] = match.map(Number)
  const requestedUtc = Date.UTC(year, month - 1, day, hour, minute)
  const probe = new Date(requestedUtc)
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    probe.getUTCHours() !== hour ||
    probe.getUTCMinutes() !== minute
  ) {
    throw new RangeError('Cairo wall clock is not a valid calendar date and time')
  }

  let instant = requestedUtc
  // Two passes cover the offset before and after a DST transition.
  for (let pass = 0; pass < 2; pass += 1) {
    const asWallUtc = localParts(new Date(instant), timeZone)
    const delta =
      Date.UTC(
        asWallUtc.year,
        asWallUtc.month - 1,
        asWallUtc.day,
        asWallUtc.hour,
        asWallUtc.minute,
      ) - requestedUtc
    if (delta === 0) break
    instant -= delta
  }

  const resolved = localParts(new Date(instant), timeZone)
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    throw new RangeError('Cairo wall clock falls in a daylight-saving gap')
  }

  return new Date(instant)
}

/** Occupancy is `[start, start + duration + 15min)`; see D3. */
export function occupancyOf(
  schedule: ShowtimeSchedule,
  turnaroundMinutes: number = SHOWTIME_TURNAROUND_MINUTES,
): OccupancyInterval {
  if (!Number.isInteger(schedule.durationMinutes) || schedule.durationMinutes <= 0) {
    throw new RangeError('Film duration must be a positive integer number of minutes')
  }
  if (!Number.isInteger(turnaroundMinutes) || turnaroundMinutes < 0) {
    throw new RangeError('Turnaround must be a non-negative integer number of minutes')
  }

  return {
    startsAt: schedule.startsAt,
    endsAt: new Date(
      schedule.startsAt.getTime() + (schedule.durationMinutes + turnaroundMinutes) * MINUTE_MS,
    ),
  }
}

/**
 * Checkout closes at `startsAt − 15 min`. The instant itself is already closed,
 * so both the public read flag and the confirmation write use this helper.
 */
export function bookingCutoffAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - BOOKING_CUTOFF_MINUTES * MINUTE_MS)
}

export function isBookingClosed(startsAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= bookingCutoffAt(startsAt).getTime()
}

/** D5: guest self-cancellation closes two hours before the showtime. */
export const GUEST_CANCELLATION_CUTOFF_MINUTES = 120

/**
 * Measured from the stored showtime instant, like the 15-minute checkout rule.
 * Both are closing instants: the boundary itself is already closed.
 */
export function guestCancellationCutoffAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - GUEST_CANCELLATION_CUTOFF_MINUTES * MINUTE_MS)
}

export function isGuestCancellationClosed(startsAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= guestCancellationCutoffAt(startsAt).getTime()
}

/** A claimed seat is unavailable; so is one the auditorium took out of service. */
export function isSeatAvailable(
  seat: { id: string; outOfService: boolean },
  claimedSeatIds: ReadonlySet<string>,
): boolean {
  return !seat.outOfService && !claimedSeatIds.has(seat.id)
}

/** Half-open overlap: touching at an endpoint is not a conflict. */
export function intervalsOverlap(a: OccupancyInterval, b: OccupancyInterval): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime()
}

/** Convenience wrapper for two showtime schedules in the same auditorium. */
export function schedulesOverlap(
  a: ShowtimeSchedule,
  b: ShowtimeSchedule,
  turnaroundMinutes: number = SHOWTIME_TURNAROUND_MINUTES,
): boolean {
  return intervalsOverlap(occupancyOf(a, turnaroundMinutes), occupancyOf(b, turnaroundMinutes))
}
