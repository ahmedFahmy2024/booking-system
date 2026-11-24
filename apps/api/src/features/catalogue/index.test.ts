import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDb: vi.fn(),
  select: vi.fn(),
}))

vi.mock('../../auth.js', () => ({
  webUrl: 'http://localhost:5173',
  auth: {
    api: { getSession: mocks.getSession },
    handler: vi.fn(),
  },
}))

vi.mock('../../db/index.js', () => ({
  getDb: () => {
    mocks.getDb()
    return { select: mocks.select }
  },
}))

import { app } from '../../app.js'

const FILM_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_FILM_ID = '11111111-1111-4111-8111-111111111112'
const SHOWTIME_ID = '44444444-4444-4444-8444-444444444444'
const OTHER_SHOWTIME_ID = '44444444-4444-4444-8444-444444444445'
const AUDITORIUM_ID = '22222222-2222-4222-8222-222222222222'

const NOW = new Date('2026-11-23T12:00:00.000Z')
const STARTS_AT = new Date('2026-12-01T16:00:00.000Z')

type ChainMethod<T> = (...args: unknown[]) => Chain<T>
interface Chain<T> extends PromiseLike<T> {
  calls: Record<string, unknown[][]>
  from: ChainMethod<T>
  innerJoin: ChainMethod<T>
  where: ChainMethod<T>
  orderBy: ChainMethod<T>
  limit: ChainMethod<T>
}

/** Drizzle select builders are thenable chains; record arguments for assertions. */
function chain<T>(result: T | (() => T)): Chain<T> {
  const value = typeof result === 'function' ? (result as () => T)() : result
  const promise = Promise.resolve(value)
  const calls: Record<string, unknown[][]> = {}
  const node: Record<string, unknown> = {
    calls,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit']) {
    node[method] = (...args: unknown[]) => {
      ;(calls[method] ??= []).push(args)
      return node
    }
  }
  return node as unknown as Chain<T>
}

function request(path: string) {
  return app.request(path)
}

/** The seat map performs a second select for claims after loading the showtime. */
function mapSelects(rows: unknown[], claimedSeatIds: string[] = []) {
  mocks.select
    .mockReturnValueOnce(chain(rows))
    .mockReturnValueOnce(chain(claimedSeatIds.map((seatId) => ({ seatId }))))
}

const catalogueRow = (overrides: Record<string, unknown> = {}) => ({
  filmId: FILM_ID,
  title: 'title A',
  durationMinutes: 120,
  synopsis: 'synopsis A',
  posterUrl: null,
  showtimeId: SHOWTIME_ID,
  startsAt: STARTS_AT,
  pricePiastres: 2500,
  auditoriumName: 'Auditorium 1',
  ...overrides,
})

const snapshot = {
  auditoriumId: AUDITORIUM_ID,
  auditoriumName: 'Auditorium 1',
  seats: [
    {
      id: 'seat-1',
      rowLabel: 'A',
      seatNumber: 1,
      aisleAfter: true,
      outOfService: false,
    },
    {
      id: 'seat-2',
      rowLabel: 'A',
      seatNumber: 2,
      aisleAfter: false,
      outOfService: true,
    },
  ],
}

const detailRow = (overrides: Record<string, unknown> = {}) => ({
  id: SHOWTIME_ID,
  filmId: FILM_ID,
  startsAt: STARTS_AT,
  pricePiastres: 2500,
  status: 'published',
  title: 'title A',
  synopsis: 'synopsis A',
  posterUrl: null,
  durationMinutes: 120,
  auditoriumName: 'Auditorium 1',
  ...overrides,
})

const mapRow = (overrides: Record<string, unknown> = {}) => ({
  id: SHOWTIME_ID,
  status: 'published',
  auditoriumName: 'Auditorium 1',
  layoutSnapshot: snapshot,
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.resetAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('public catalogue', () => {
  it('returns films with their published upcoming showtimes without a session', async () => {
    const selected = chain([
      catalogueRow(),
      catalogueRow({
        filmId: FILM_ID,
        showtimeId: OTHER_SHOWTIME_ID,
        startsAt: new Date('2026-12-02T16:00:00.000Z'),
        pricePiastres: 3000,
        auditoriumName: 'Auditorium 2',
        layoutSnapshot: { auditoriumName: 'Frozen Hall', seats: [] },
      }),
      catalogueRow({
        filmId: OTHER_FILM_ID,
        title: 'title B',
        synopsis: 'synopsis B',
        showtimeId: '55555555-5555-4555-8555-555555555555',
      }),
    ])
    mocks.select.mockReturnValue(selected)

    const res = await request('/films')

    expect(res.status).toBe(200)
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.getDb).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body).toEqual([
      {
        id: FILM_ID,
        title: 'title A',
        durationMinutes: 120,
        synopsis: 'synopsis A',
        posterUrl: null,
        showtimes: [
          {
            id: SHOWTIME_ID,
            startsAt: STARTS_AT.toISOString(),
            pricePiastres: 2500,
            auditoriumName: 'Auditorium 1',
          },
          {
            id: OTHER_SHOWTIME_ID,
            startsAt: '2026-12-02T16:00:00.000Z',
            pricePiastres: 3000,
            auditoriumName: 'Frozen Hall',
          },
        ],
      },
      {
        id: OTHER_FILM_ID,
        title: 'title B',
        durationMinutes: 120,
        synopsis: 'synopsis B',
        posterUrl: null,
        showtimes: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            startsAt: STARTS_AT.toISOString(),
            pricePiastres: 2500,
            auditoriumName: 'Auditorium 1',
          },
        ],
      },
    ])
    expect(JSON.stringify(body)).not.toContain('layoutSnapshot')
    expect(JSON.stringify(body)).not.toContain('customerEmail')

    // The status and future-instant filters are applied at the database boundary.
    const filter = new PgDialect().sqlToQuery(selected.calls.where[0][0] as never)
    expect(filter.sql).toContain('"status"')
    expect(filter.sql).toContain('"starts_at"')
    expect(filter.params).toContain('published')
    expect(filter.params.some((value) => String(value).startsWith('2026-11-23'))).toBe(true)
  })

  it('returns a fresh 200 on a retry after a failed read', async () => {
    mocks.select
      .mockImplementationOnce(() => chain(() => Promise.reject(new Error('network down'))))
      .mockImplementationOnce(() => chain([catalogueRow()]))

    const failed = await request('/films')
    expect(failed.status).toBe(500)

    const retried = await request('/films')
    expect(retried.status).toBe(200)
    expect(await retried.json()).toHaveLength(1)
  })
})

describe('public showtime heading', () => {
  it('returns heading fields only and an open booking window before the cutoff', async () => {
    mocks.select.mockReturnValue(chain([detailRow()]))

    const res = await request(`/showtimes/${SHOWTIME_ID}`)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: SHOWTIME_ID,
      filmId: FILM_ID,
      filmTitle: 'title A',
      synopsis: 'synopsis A',
      posterUrl: null,
      durationMinutes: 120,
      startsAt: STARTS_AT.toISOString(),
      auditoriumName: 'Auditorium 1',
      pricePiastres: 2500,
      bookingClosed: false,
    })
  })

  it('uses the auditorium name frozen at publish and filters out past showtimes', async () => {
    const selected = chain([
      detailRow({ layoutSnapshot: { auditoriumName: 'Frozen Hall', seats: [] } }),
    ])
    mocks.select.mockReturnValue(selected)

    const res = await request(`/showtimes/${SHOWTIME_ID}`)

    expect(res.status).toBe(200)
    expect((await res.json()).auditoriumName).toBe('Frozen Hall')
    const filter = new PgDialect().sqlToQuery(selected.calls.where[0][0] as never)
    expect(filter.sql).toContain('"starts_at"')
    expect(filter.params.some((value) => String(value).startsWith('2026-11-23'))).toBe(true)
  })

  it('reports the booking window closed at the exact cutoff', async () => {
    vi.setSystemTime(new Date(STARTS_AT.getTime() - 15 * 60_000))
    mocks.select.mockReturnValue(chain([detailRow()]))

    const res = await request(`/showtimes/${SHOWTIME_ID}`)

    expect(res.status).toBe(200)
    expect((await res.json()).bookingClosed).toBe(true)
  })

  it.each([
    ['an unknown id', '66666666-6666-4666-8666-666666666666'],
    ['a malformed id', 'not-a-uuid'],
    ['a draft', SHOWTIME_ID, { status: 'draft' }],
    ['a cancelled showtime', SHOWTIME_ID, { status: 'cancelled' }],
  ])('gives the same generic denial for %s', async (_label, id, overrides: Record<string, unknown> = {}) => {
    mocks.select.mockReturnValue(
      chain(Object.keys(overrides).length ? [detailRow(overrides)] : []),
    )

    const res = await request(`/showtimes/${id}`)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'showtime_not_found' })
    if (id === 'not-a-uuid') expect(mocks.select).not.toHaveBeenCalled()
  })
})

describe('public seat map', () => {
  it('returns labelled seats with availability derived from the snapshot and claims', async () => {
    mapSelects([mapRow()], ['seat-1'])

    const res = await request(`/showtimes/${SHOWTIME_ID}/seat-map`)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      showtimeId: SHOWTIME_ID,
      auditoriumName: 'Auditorium 1',
      seats: [
        {
          id: 'seat-1',
          rowLabel: 'A',
          seatNumber: 1,
          aisleAfter: true,
          outOfService: false,
          available: false,
        },
        {
          id: 'seat-2',
          rowLabel: 'A',
          seatNumber: 2,
          aisleAfter: false,
          outOfService: true,
          available: false,
        },
      ],
    })
  })

  it('keeps other seats available when one seat has been claimed', async () => {
    const twoSeatSnapshot = {
      ...snapshot,
      seats: [snapshot.seats[0], { ...snapshot.seats[1], outOfService: false }],
    }
    mapSelects([mapRow({ layoutSnapshot: twoSeatSnapshot })], ['seat-1'])

    const res = await request(`/showtimes/${SHOWTIME_ID}/seat-map`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.seats.map((seat: { available: boolean }) => seat.available)).toEqual([false, true])
  })

  it('uses the frozen auditorium name and filters out past showtimes', async () => {
    const selected = chain([
      mapRow({ layoutSnapshot: { ...snapshot, auditoriumName: 'Frozen Hall' } }),
    ])
    mocks.select.mockReturnValueOnce(selected).mockReturnValueOnce(chain([]))

    const res = await request(`/showtimes/${SHOWTIME_ID}/seat-map`)

    expect(res.status).toBe(200)
    expect((await res.json()).auditoriumName).toBe('Frozen Hall')
    const filter = new PgDialect().sqlToQuery(selected.calls.where[0][0] as never)
    expect(filter.sql).toContain('"starts_at"')
    expect(filter.params.some((value) => String(value).startsWith('2026-11-23'))).toBe(true)
  })

  it.each([
    ['an unknown id', '66666666-6666-4666-8666-666666666666'],
    ['a malformed id', 'not-a-uuid'],
    ['a draft', SHOWTIME_ID, { status: 'draft' }],
    ['a cancelled showtime', SHOWTIME_ID, { status: 'cancelled' }],
  ])('gives the same generic denial for %s', async (_label, id, overrides: Record<string, unknown> = {}) => {
    mapSelects(Object.keys(overrides).length ? [mapRow(overrides)] : [])

    const res = await request(`/showtimes/${id}/seat-map`)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'showtime_not_found' })
    if (id === 'not-a-uuid') expect(mocks.select).not.toHaveBeenCalled()
  })

  it('does not expose a published showtime with a missing snapshot', async () => {
    mapSelects([mapRow({ layoutSnapshot: null })])

    const res = await request(`/showtimes/${SHOWTIME_ID}/seat-map`)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'seat_map_unavailable' })
  })

  it('is a read-only path that does not require a staff session', async () => {
    mapSelects([mapRow()])

    await request(`/showtimes/${SHOWTIME_ID}/seat-map`)

    expect(mocks.getSession).not.toHaveBeenCalled()
  })
})
