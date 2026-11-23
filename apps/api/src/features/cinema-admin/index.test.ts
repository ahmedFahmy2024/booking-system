import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDb: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  batch: vi.fn(),
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
    return {
      select: mocks.select,
      insert: mocks.insert,
      update: mocks.update,
      delete: mocks.delete,
      batch: mocks.batch,
    }
  },
}))

import { app } from '../../app.js'
import { auditoriumWriteSchema } from './index.js'

const FILM_ID = '11111111-1111-4111-8111-111111111111'
const AUDITORIUM_ID = '22222222-2222-4222-8222-222222222222'

const adminSession = {
  user: { id: 'admin-1', role: 'admin', banned: false },
  session: { id: 'session-1' },
}

/** A Drizzle builder is a thenable chain; this mock resolves at every terminal. */
function chain<T>(result: T) {
  const promise = Promise.resolve(result)
  const node: Record<string, (...args: never[]) => unknown> = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  for (const method of ['from', 'where', 'orderBy', 'limit', 'set', 'values', 'returning']) {
    node[method] = () => node
  }
  return node
}

const filmRow = {
  id: FILM_ID,
  title: 'Cairo Nights',
  durationMinutes: 120,
  synopsis: 'A story set in Cairo.',
  posterUrl: null,
}

const filmPayload = {
  title: 'Cairo Nights',
  durationMinutes: 120,
  synopsis: 'A story set in Cairo.',
}

const auditoriumPayload = {
  name: 'Main Hall',
  seats: [
    { rowLabel: 'a', seatNumber: 1, aisleAfter: true, isOutOfService: false },
    { rowLabel: 'a', seatNumber: 2, aisleAfter: false, isOutOfService: true },
    { rowLabel: 'B', seatNumber: 1, aisleAfter: false, isOutOfService: false },
  ],
}

const seatRows = [
  {
    id: '33333333-3333-4333-8333-333333333331',
    auditoriumId: AUDITORIUM_ID,
    rowLabel: 'A',
    seatNumber: 1,
    aisleAfter: true,
    isOutOfService: false,
  },
  {
    id: '33333333-3333-4333-8333-333333333332',
    auditoriumId: AUDITORIUM_ID,
    rowLabel: 'A',
    seatNumber: 2,
    aisleAfter: false,
    isOutOfService: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    auditoriumId: AUDITORIUM_ID,
    rowLabel: 'B',
    seatNumber: 1,
    aisleAfter: false,
    isOutOfService: false,
  },
]

function seatView(row: (typeof seatRows)[number]) {
  return {
    id: row.id,
    rowLabel: row.rowLabel,
    seatNumber: row.seatNumber,
    aisleAfter: row.aisleAfter,
    isOutOfService: row.isOutOfService,
  }
}

function request(path: string, method = 'GET', body?: unknown) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.select.mockImplementation(() => chain([]))
  mocks.insert.mockImplementation(() => chain([]))
  mocks.update.mockImplementation(() => chain([]))
  mocks.delete.mockImplementation(() => chain(undefined))
})

describe('admin cinema routes — access control', () => {
  it('returns 401 with no database work when there is no session', async () => {
    mocks.getSession.mockResolvedValue(null)

    const res = await request('/admin/films')

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'authentication_required' })
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('denies operations, banned admins and unknown roles for reads and writes', async () => {
    for (const user of [
      { id: 'ops-1', role: 'operations', banned: false },
      { id: 'admin-1', role: 'admin', banned: true },
      { id: 'guest-1', role: 'customer', banned: false },
    ]) {
      mocks.getSession.mockResolvedValue({ user, session: { id: 's' } })

      const list = await request('/admin/films')
      const create = await request('/admin/films', 'POST', filmPayload)
      const auditoriums = await request('/admin/auditoriums', 'POST', auditoriumPayload)

      expect(list.status).toBe(403)
      expect(create.status).toBe(403)
      expect(auditoriums.status).toBe(403)
    }
    expect(mocks.getDb).not.toHaveBeenCalled()
  })

  it('lets an active admin read the protected resources', async () => {
    mocks.getSession.mockResolvedValue(adminSession)
    mocks.select.mockImplementation(() => chain([filmRow]))

    const res = await request('/admin/films')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: FILM_ID,
        title: 'Cairo Nights',
        durationMinutes: 120,
        synopsis: 'A story set in Cairo.',
        posterUrl: null,
      },
    ])
  })
})

describe('admin cinema routes — films', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(adminSession)
  })

  it('creates a film with a valid payload and maps an empty poster URL to null', async () => {
    mocks.insert.mockImplementation(() => chain([filmRow]))

    const res = await request('/admin/films', 'POST', { ...filmPayload, posterUrl: '' })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      id: FILM_ID,
      title: 'Cairo Nights',
      durationMinutes: 120,
      synopsis: 'A story set in Cairo.',
      posterUrl: null,
    })
  })

  it('accepts an explicit null poster URL from the web form', async () => {
    mocks.insert.mockImplementation(() => chain([filmRow]))

    const res = await request('/admin/films', 'POST', { ...filmPayload, posterUrl: null })

    expect(res.status).toBe(201)
    expect((await res.json()).posterUrl).toBeNull()
  })

  it('rejects invalid film data with 400 and never inserts', async () => {
    const invalid = [
      { ...filmPayload, title: '   ' },
      { ...filmPayload, durationMinutes: 0 },
      { ...filmPayload, durationMinutes: 1.5 },
      { ...filmPayload, synopsis: '' },
      { ...filmPayload, posterUrl: 'not-a-url' },
    ]
    for (const payload of invalid) {
      const res = await request('/admin/films', 'POST', payload)
      expect(res.status).toBe(400)
    }
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('updates an existing film and returns 404 for an unknown id', async () => {
    mocks.update.mockImplementation(() => chain([{ ...filmRow, title: 'New Title' }]))

    const updated = await request(`/admin/films/${FILM_ID}`, 'PATCH', {
      ...filmPayload,
      title: 'New Title',
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).title).toBe('New Title')

    mocks.update.mockImplementation(() => chain([]))
    const missing = await request(`/admin/films/${FILM_ID}`, 'PATCH', filmPayload)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'film_not_found' })
  })
})

describe('admin cinema routes — auditoriums and seats', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(adminSession)
  })

  it('normalises row labels to uppercase before any write', () => {
    const parsed = auditoriumWriteSchema.parse(auditoriumPayload)
    expect(parsed.seats.map((seat) => seat.rowLabel)).toEqual(['A', 'A', 'B'])
    expect(parsed.seats[0].aisleAfter).toBe(true)
    expect(parsed.seats[1].isOutOfService).toBe(true)
  })

  it('creates an auditorium with uppercase row labels in one batch', async () => {
    mocks.batch.mockResolvedValue([
      [{ id: AUDITORIUM_ID, name: 'Main Hall' }],
      undefined,
      seatRows,
    ])

    const res = await request('/admin/auditoriums', 'POST', auditoriumPayload)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      id: AUDITORIUM_ID,
      name: 'Main Hall',
      seats: seatRows.map(seatView),
    })
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    const queries = mocks.batch.mock.calls[0][0]
    expect(queries).toHaveLength(3)
  })

  it('rejects duplicate seats, non-positive numbers and blank labels before any write', async () => {
    const invalid = [
      {
        ...auditoriumPayload,
        seats: [
          auditoriumPayload.seats[0],
          { ...auditoriumPayload.seats[0], aisleAfter: false },
        ],
      },
      {
        ...auditoriumPayload,
        seats: [{ rowLabel: 'A', seatNumber: 0 }],
      },
      {
        ...auditoriumPayload,
        seats: [{ rowLabel: ' ', seatNumber: 1 }],
      },
    ]
    for (const payload of invalid) {
      const res = await request('/admin/auditoriums', 'POST', payload)
      // The installed @hono/zod-validator returns 400 on a schema failure,
      // matching the existing booking route tests.
      expect(res.status).toBe(400)
    }
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it('replaces the whole seat map atomically and returns the new layout', async () => {
    mocks.select.mockImplementation(() => chain([{ id: AUDITORIUM_ID }]))
    mocks.batch.mockResolvedValue([
      [{ id: AUDITORIUM_ID, name: 'Renamed Hall' }],
      undefined,
      undefined,
      [seatRows[0]],
    ])

    const res = await request(`/admin/auditoriums/${AUDITORIUM_ID}`, 'PUT', {
      name: 'Renamed Hall',
      seats: [{ rowLabel: 'a', seatNumber: 1, aisleAfter: true, isOutOfService: false }],
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: AUDITORIUM_ID,
      name: 'Renamed Hall',
      seats: [seatView(seatRows[0])],
    })
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    const queries = mocks.batch.mock.calls[0][0]
    // name update, seat delete, seat insert and final read are one transaction.
    expect(queries).toHaveLength(4)
  })

  it('returns 404 when replacing seats on an unknown auditorium', async () => {
    mocks.batch.mockResolvedValue([[], undefined, undefined, []])

    const res = await request(`/admin/auditoriums/${AUDITORIUM_ID}`, 'PUT', {
      name: 'Missing',
      seats: [],
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'auditorium_not_found' })
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it('keeps the empty-seat case in the same atomic batch shape', async () => {
    mocks.select.mockImplementation(() => chain([{ id: AUDITORIUM_ID }]))
    mocks.batch.mockResolvedValue([
      [{ id: AUDITORIUM_ID, name: 'Empty Hall' }],
      undefined,
      undefined,
      [],
    ])

    const res = await request(`/admin/auditoriums/${AUDITORIUM_ID}`, 'PUT', {
      name: 'Empty Hall',
      seats: [],
    })

    expect(res.status).toBe(200)
    expect((await res.json()).seats).toEqual([])
    expect(mocks.batch.mock.calls[0][0]).toHaveLength(4)
  })

  it('lists auditoriums with their seats', async () => {
    mocks.select
      .mockImplementationOnce(() => chain([{ id: AUDITORIUM_ID, name: 'Main Hall' }]))
      .mockImplementationOnce(() => chain(seatRows))

    const res = await request('/admin/auditoriums')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: AUDITORIUM_ID, name: 'Main Hall', seats: seatRows.map(seatView) },
    ])
  })

  it('does not partially apply a seat map when the batch fails', async () => {
    mocks.select.mockImplementation(() => chain([{ id: AUDITORIUM_ID }]))
    mocks.batch.mockRejectedValue(new Error('unique_violation'))

    const res = await request(`/admin/auditoriums/${AUDITORIUM_ID}`, 'PUT', {
      name: 'Main Hall',
      seats: auditoriumPayload.seats,
    })

    expect(res.status).toBe(500)
    // One rejected batch means Postgres rolls back the delete with the insert.
    expect(mocks.batch).toHaveBeenCalledTimes(1)
  })
})
