import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDb: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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
    return { select: mocks.select, insert: mocks.insert, update: mocks.update }
  },
}))

import { app } from '../../app.js'

const FILM_ID = '11111111-1111-4111-8111-111111111111'
const AUDITORIUM_ID = '22222222-2222-4222-8222-222222222222'
const SHOWTIME_ID = '44444444-4444-4444-8444-444444444444'

const adminSession = {
  user: { id: 'admin-1', role: 'admin', banned: false },
  session: { id: 'session-1' },
}

type ChainMethod<T> = (...args: unknown[]) => Chain<T>
interface Chain<T> extends PromiseLike<T> {
  calls: Record<string, unknown[][]>
  from: ChainMethod<T>
  where: ChainMethod<T>
  orderBy: ChainMethod<T>
  limit: ChainMethod<T>
  set: ChainMethod<T>
  values: ChainMethod<T>
  returning: ChainMethod<T>
}

/** A Drizzle builder is a thenable chain; record method arguments for assertions. */
function chain<T>(result: T): Chain<T> {
  const promise = Promise.resolve(result)
  const calls: Record<string, unknown[][]> = {}
  const node: Record<string, unknown> = {
    calls,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  for (const method of ['from', 'where', 'orderBy', 'limit', 'set', 'values', 'returning']) {
    node[method] = (...args: unknown[]) => {
      ;(calls[method] ??= []).push(args)
      return node
    }
  }
  return node as unknown as Chain<T>
}

const seatRows = [
  {
    id: '33333333-3333-4333-8333-333333333331',
    rowLabel: 'A',
    seatNumber: 1,
    aisleAfter: true,
    isOutOfService: false,
  },
  {
    id: '33333333-3333-4333-8333-333333333332',
    rowLabel: 'A',
    seatNumber: 2,
    aisleAfter: false,
    isOutOfService: true,
  },
]

const startsAt = new Date('2026-07-15T16:00:00.000Z')
const occupancyEndsAt = new Date('2026-07-15T18:15:00.000Z')

function showtimeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SHOWTIME_ID,
    filmId: FILM_ID,
    auditoriumId: AUDITORIUM_ID,
    startsAt,
    occupancyEndsAt,
    status: 'draft',
    pricePiastres: 0,
    layoutSnapshot: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  }
}

function showtimeView(row: ReturnType<typeof showtimeRow>) {
  return {
    id: row.id,
    filmId: row.filmId,
    auditoriumId: row.auditoriumId,
    startsAt: row.startsAt.toISOString(),
    occupancyEndsAt: row.occupancyEndsAt.toISOString(),
    status: row.status,
    pricePiastres: row.pricePiastres,
    layoutSnapshot: row.layoutSnapshot,
  }
}

const createPayload = {
  filmId: FILM_ID,
  auditoriumId: AUDITORIUM_ID,
  // Cairo summer is UTC+3, so 19:00 wall clock is 16:00Z.
  startsAt: '2026-07-15T19:00',
}

function request(path: string, method = 'GET', body?: unknown) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const showtimeRequests = () => [
  request('/admin/showtimes'),
  request('/admin/showtimes', 'POST', createPayload),
  request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', { pricePiastres: 2500 }),
  request(`/admin/showtimes/${SHOWTIME_ID}/price`, 'PATCH', { pricePiastres: 3000 }),
]

/** Queue the four reads a publish performs: showtime, film, auditorium, seats. */
function queuePublishReads(
  current: ReturnType<typeof showtimeRow>,
  seats = seatRows,
  durationMinutes = 120,
) {
  mocks.select
    .mockImplementationOnce(() => chain([current]))
    .mockImplementationOnce(() => chain([{ durationMinutes }]))
    .mockImplementationOnce(() => chain([{ id: AUDITORIUM_ID, name: 'Main Hall' }]))
    .mockImplementationOnce(() => chain(seats))
}

const expectedSnapshot = {
  auditoriumId: AUDITORIUM_ID,
  auditoriumName: 'Main Hall',
  seats: seatRows.map((seat) => ({
    id: seat.id,
    rowLabel: seat.rowLabel,
    seatNumber: seat.seatNumber,
    aisleAfter: seat.aisleAfter,
    outOfService: seat.isOutOfService,
  })),
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.select.mockImplementation(() => chain([]))
  mocks.insert.mockImplementation(() => chain([]))
  mocks.update.mockImplementation(() => chain([]))
})

describe('admin showtime routes — access control', () => {
  it('returns 401 with no database work when there is no session', async () => {
    mocks.getSession.mockResolvedValue(null)

    for (const res of await Promise.all(showtimeRequests())) {
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'authentication_required' })
    }
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('denies operations, banned admins and unknown roles on reads and writes', async () => {
    for (const { user, error } of [
      {
        user: { id: 'ops-1', role: 'operations', banned: false },
        error: 'forbidden',
      },
      {
        user: { id: 'admin-1', role: 'admin', banned: true },
        error: 'staff_account_inactive',
      },
      {
        user: { id: 'guest-1', role: 'customer', banned: false },
        error: 'forbidden',
      },
    ]) {
      mocks.getSession.mockResolvedValue({ user, session: { id: 's' } })

      for (const res of await Promise.all(showtimeRequests())) {
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error })
      }
    }
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('lets an active admin list showtimes as ISO instants', async () => {
    mocks.getSession.mockResolvedValue(adminSession)
    mocks.select.mockImplementation(() => chain([showtimeRow()]))

    const res = await request('/admin/showtimes')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([showtimeView(showtimeRow())])
  })
})

describe('admin showtime routes — draft creation', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(adminSession)
  })

  it('resolves a Cairo wall clock and stores the occupancy end from film duration', async () => {
    mocks.select
      .mockImplementationOnce(() => chain([{ durationMinutes: 120 }]))
      .mockImplementationOnce(() => chain([{ id: AUDITORIUM_ID }]))
    const inserted = chain([showtimeRow()])
    mocks.insert.mockImplementation(() => inserted)

    const res = await request('/admin/showtimes', 'POST', createPayload)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(showtimeView(showtimeRow()))
    expect(inserted.calls.values[0][0]).toEqual({
      filmId: FILM_ID,
      auditoriumId: AUDITORIUM_ID,
      startsAt,
      occupancyEndsAt,
      pricePiastres: 0,
    })
  })

  it('accepts an optional draft price and resolves a winter wall clock at UTC+2', async () => {
    mocks.select
      .mockImplementationOnce(() => chain([{ durationMinutes: 90 }]))
      .mockImplementationOnce(() => chain([{ id: AUDITORIUM_ID }]))
    const inserted = chain([showtimeRow({ pricePiastres: 1500 })])
    mocks.insert.mockImplementation(() => inserted)

    const res = await request('/admin/showtimes', 'POST', {
      ...createPayload,
      startsAt: '2026-01-15T19:00',
      pricePiastres: 1500,
    })

    expect(res.status).toBe(201)
    expect(inserted.calls.values[0][0]).toMatchObject({
      startsAt: new Date('2026-01-15T17:00:00.000Z'),
      occupancyEndsAt: new Date('2026-01-15T18:45:00.000Z'),
      pricePiastres: 1500,
    })
  })

  it('rejects a spring-forward gap wall clock before any database work', async () => {
    const res = await request('/admin/showtimes', 'POST', {
      ...createPayload,
      startsAt: '2026-04-24T00:30',
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_cairo_wall_clock' })
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('accepts a corrected retry after a rejected wall clock', async () => {
    const rejected = await request('/admin/showtimes', 'POST', {
      ...createPayload,
      startsAt: '2026-04-24T00:30',
    })
    expect(rejected.status).toBe(400)
    expect(mocks.getDb).not.toHaveBeenCalled()

    mocks.select
      .mockImplementationOnce(() => chain([{ durationMinutes: 120 }]))
      .mockImplementationOnce(() => chain([{ id: AUDITORIUM_ID }]))
    mocks.insert.mockImplementation(() => chain([showtimeRow()]))

    const retried = await request('/admin/showtimes', 'POST', createPayload)
    expect(retried.status).toBe(201)
    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })

  it('rejects a negative price and a malformed wall clock before any database work', async () => {
    for (const payload of [
      { ...createPayload, pricePiastres: -1 },
      { ...createPayload, startsAt: '2026-07-15 19:00' },
      { ...createPayload, filmId: 'not-a-uuid' },
    ]) {
      const res = await request('/admin/showtimes', 'POST', payload)
      expect(res.status).toBe(400)
    }
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown film or auditorium without inserting', async () => {
    mocks.select.mockImplementationOnce(() => chain([]))
    const missingFilm = await request('/admin/showtimes', 'POST', createPayload)
    expect(missingFilm.status).toBe(404)
    expect(await missingFilm.json()).toEqual({ error: 'film_not_found' })

    mocks.select
      .mockImplementationOnce(() => chain([{ durationMinutes: 120 }]))
      .mockImplementationOnce(() => chain([]))
    const missingAuditorium = await request('/admin/showtimes', 'POST', createPayload)
    expect(missingAuditorium.status).toBe(404)
    expect(await missingAuditorium.json()).toEqual({ error: 'auditorium_not_found' })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('maps a Postgres exclusion violation to 409 with no partial row', async () => {
    mocks.select
      .mockImplementationOnce(() => chain([{ durationMinutes: 120 }]))
      .mockImplementationOnce(() => chain([{ id: AUDITORIUM_ID }]))
    mocks.insert.mockImplementation(() => {
      // Drizzle wraps Neon errors; walk past an intermediate cause too.
      throw new Error('outer', {
        cause: new Error('drizzle wrapper', {
          cause: Object.assign(new Error('exclusion_violation'), { code: '23P01' }),
        }),
      })
    })

    const res = await request('/admin/showtimes', 'POST', createPayload)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'showtime_overlap' })
  })
})

describe('admin showtime routes — publishing', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(adminSession)
  })

  it('requires a positive price before any database work', async () => {
    for (const pricePiastres of [0, -1, 1.5]) {
      const res = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
        pricePiastres,
      })
      expect(res.status).toBe(400)
    }
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('accepts a corrected price after a rejected publish', async () => {
    const rejected = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
      pricePiastres: 0,
    })
    expect(rejected.status).toBe(400)
    expect(mocks.getDb).not.toHaveBeenCalled()

    queuePublishReads(showtimeRow())
    mocks.update.mockImplementation(() =>
      chain([showtimeRow({ status: 'published', pricePiastres: 2500 })]),
    )

    const retried = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
      pricePiastres: 2500,
    })
    expect(retried.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })

  it('publishes a draft with the snapshot and occupancy from the current duration', async () => {
    // The draft was created against a 120-minute film; the film is now 180.
    // Publishing must recompute 16:00Z + 180 + 15 = 19:15Z, not reuse the old end.
    queuePublishReads(showtimeRow(), seatRows, 180)
    const recomputedEnd = new Date('2026-07-15T19:15:00.000Z')
    const published = showtimeRow({
      status: 'published',
      pricePiastres: 2500,
      layoutSnapshot: expectedSnapshot,
      occupancyEndsAt: recomputedEnd,
    })
    const updated = chain([published])
    mocks.update.mockImplementation(() => updated)

    const res = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
      pricePiastres: 2500,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(showtimeView(published))
    expect(updated.calls.set[0][0]).toEqual({
      status: 'published',
      pricePiastres: 2500,
      layoutSnapshot: expectedSnapshot,
      occupancyEndsAt: recomputedEnd,
    })
    // The compare-and-swap guard is what stops two publishes of one draft.
    const guard = new PgDialect().sqlToQuery(updated.calls.where[0][0] as never)
    expect(guard.sql).toContain('"showtimes"."status"')
    expect(guard.params).toContain('draft')
  })

  it('returns 404 for an unknown showtime without writing', async () => {
    const res = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
      pricePiastres: 2500,
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'showtime_not_found' })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refuses to publish a non-draft showtime', async () => {
    for (const status of ['published', 'cancelled']) {
      queuePublishReads(showtimeRow({ status }))
      const res = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
        pricePiastres: 2500,
      })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'invalid_status_transition' })
    }
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refuses to publish an auditorium with no seats', async () => {
    queuePublishReads(showtimeRow(), [])

    const res = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
      pricePiastres: 2500,
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'auditorium_has_no_seats' })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('maps a competing overlapping publish to 409', async () => {
    queuePublishReads(showtimeRow())
    mocks.update.mockImplementation(() => {
      throw Object.assign(new Error('exclusion_violation'), { code: '23P01' })
    })

    const res = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
      pricePiastres: 2500,
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'showtime_overlap' })
  })

  it('returns 409 when a competing publish of the same draft wins the status guard', async () => {
    queuePublishReads(showtimeRow())

    const res = await request(`/admin/showtimes/${SHOWTIME_ID}/publish`, 'POST', {
      pricePiastres: 2500,
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'invalid_status_transition' })
  })
})

describe('admin showtime routes — price changes', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(adminSession)
  })

  it('changes the price of a published showtime', async () => {
    const updated = chain([showtimeRow({ status: 'published', pricePiastres: 3000 })])
    mocks.update.mockImplementation(() => updated)

    const res = await request(`/admin/showtimes/${SHOWTIME_ID}/price`, 'PATCH', {
      pricePiastres: 3000,
    })

    expect(res.status).toBe(200)
    expect(updated.calls.set[0][0]).toEqual({ pricePiastres: 3000 })
  })

  it('rejects a cancelled showtime and an unknown id distinctly', async () => {
    mocks.select.mockImplementationOnce(() => chain([{ id: SHOWTIME_ID }]))
    const cancelled = await request(`/admin/showtimes/${SHOWTIME_ID}/price`, 'PATCH', {
      pricePiastres: 3000,
    })
    expect(cancelled.status).toBe(409)
    expect(await cancelled.json()).toEqual({ error: 'invalid_status_transition' })

    const missing = await request(`/admin/showtimes/${SHOWTIME_ID}/price`, 'PATCH', {
      pricePiastres: 3000,
    })
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'showtime_not_found' })
  })

  it('rejects a non-positive price before any database work', async () => {
    const res = await request(`/admin/showtimes/${SHOWTIME_ID}/price`, 'PATCH', {
      pricePiastres: 0,
    })

    expect(res.status).toBe(400)
    expect(mocks.getDb).not.toHaveBeenCalled()
  })
})
