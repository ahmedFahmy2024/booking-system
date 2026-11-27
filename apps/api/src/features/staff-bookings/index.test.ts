import { PgDialect } from 'drizzle-orm/pg-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
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
  getDb: () => ({ select: mocks.select }),
}))

import { app } from '../../app.js'

const FILM_ID = '11111111-1111-4111-8111-111111111111'
const SHOWTIME_ID = '44444444-4444-4444-8444-444444444444'
const BOOKING_ID = '77777777-7777-4777-8777-777777777777'
const SEAT_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const SEAT_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const SEAT_3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
const NOW = new Date('2026-11-27T12:00:00.000Z')
const STARTS_AT = new Date('2026-12-01T16:00:00.000Z')

const operationsSession = { user: { id: 'ops-1', role: 'operations' }, session: { id: 's-ops' } }
const adminSession = { user: { id: 'admin-1', role: 'admin' }, session: { id: 's-admin' } }
const bannedSession = { user: { id: 'ops-2', role: 'operations', banned: true }, session: { id: 's-banned' } }
const wrongRoleSession = { user: { id: 'guest-1', role: 'customer' }, session: { id: 's-guest' } }

type ChainMethod<T> = (...args: unknown[]) => Chain<T>
interface Chain<T> extends PromiseLike<T> {
  calls: Record<string, unknown[][]>
  from: ChainMethod<T>
  innerJoin: ChainMethod<T>
  leftJoin: ChainMethod<T>
  where: ChainMethod<T>
  orderBy: ChainMethod<T>
  limit: ChainMethod<T>
  offset: ChainMethod<T>
}

/** Drizzle selects are thenable chains; record arguments for SQL assertions. */
function chain<T>(result: T): Chain<T> {
  const promise = Promise.resolve(result)
  const calls: Record<string, unknown[][]> = {}
  const node: Record<string, unknown> = {
    calls,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  for (const method of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset']) {
    node[method] = (...args: unknown[]) => {
      ;(calls[method] ??= []).push(args)
      return node
    }
  }
  return node as unknown as Chain<T>
}

const frozenResponse = {
  id: BOOKING_ID,
  reference: 'bkg_staff_1',
  showtimeId: SHOWTIME_ID,
  filmTitle: 'فيلم الاختبار',
  startsAt: STARTS_AT.toISOString(),
  auditoriumName: 'القاعة ١',
  seatLabels: ['A1', 'A2'],
  seatIds: [SEAT_1, SEAT_2],
  unitPricePiastres: 2500,
  totalPiastres: 5000,
}

const listRow = {
  id: BOOKING_ID,
  reference: 'bkg_staff_1',
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  status: 'confirmed' as const,
  startsAt: NOW,
  showtimeStartsAt: STARTS_AT,
  filmTitle: 'Live title',
  serviceName: null,
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  cancelledAt: null,
  idempotencyResponse: frozenResponse,
}

const legacyListRow = {
  ...listRow,
  id: '77777777-7777-4777-8777-777777777778',
  reference: 'bkg_legacy',
  customerName: 'Legacy',
  startsAt: new Date('2026-12-02T10:00:00.000Z'),
  showtimeStartsAt: null,
  filmTitle: null,
  serviceName: 'Haircut',
  unitPricePiastres: null,
  totalPiastres: null,
  idempotencyResponse: null,
}

const detailRow = {
  id: BOOKING_ID,
  reference: 'bkg_staff_1',
  status: 'cancelled' as const,
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  startsAt: NOW,
  showtimeId: SHOWTIME_ID,
  showtimeStatus: 'cancelled' as const,
  filmTitle: 'Live title',
  serviceName: null,
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  cancelledAt: new Date('2026-11-27T11:00:00.000Z'),
  cancelledByUserId: 'admin-1',
  cancellationReason: 'Guest request',
  guestLinkExpiresAt: new Date('2026-12-08T16:00:00.000Z'),
  idempotencyResponse: frozenResponse,
}

const snapshot = {
  auditoriumId: '22222222-2222-4222-8222-222222222222',
  auditoriumName: 'القاعة ١',
  seats: [
    { id: SEAT_1, rowLabel: 'A', seatNumber: 1, aisleAfter: false, outOfService: false },
    { id: SEAT_2, rowLabel: 'A', seatNumber: 2, aisleAfter: false, outOfService: false },
    { id: SEAT_3, rowLabel: 'A', seatNumber: 3, aisleAfter: false, outOfService: true },
  ],
}

const occupancyRow = {
  id: SHOWTIME_ID,
  filmTitle: 'فيلم الاختبار',
  startsAt: STARTS_AT,
  status: 'published' as const,
  layoutSnapshot: snapshot,
}

function compiledSql(result: Chain<unknown>, method: string, index = 0) {
  return new PgDialect().sqlToQuery(result.calls[method][index][0] as never)
}

function list(headers?: HeadersInit) {
  return app.request('/staff/bookings', { headers })
}
function detail(id = BOOKING_ID) {
  return app.request(`/staff/bookings/${id}`)
}
function occupancy(id = SHOWTIME_ID) {
  return app.request(`/staff/showtimes/${id}/occupancy`)
}
function filters() {
  return app.request('/staff/bookings/filters')
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('B6.1 staff booking reads', () => {
  describe('access control (AC1)', () => {
    it.each([
      ['anonymous', null, 401, 'authentication_required'],
      ['banned', bannedSession, 403, 'staff_account_inactive'],
      ['wrong role', wrongRoleSession, 403, 'forbidden'],
    ])('denies %s before any database read on every route', async (_label, session, status, code) => {
      mocks.getSession.mockResolvedValue(session)
      for (const request of [list, detail, occupancy, filters]) {
        const res = await request()
        expect(res.status).toBe(status)
        expect(await res.json()).toEqual({ error: code })
      }
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it('allows both active staff roles on every route', async () => {
      for (const session of [operationsSession, adminSession]) {
        mocks.getSession.mockResolvedValue(session)
        mocks.select
          .mockReturnValueOnce(chain([{ count: 0 }]))
          .mockReturnValueOnce(chain([]))
          .mockReturnValueOnce(chain([detailRow]))
          .mockReturnValueOnce(chain([occupancyRow]))
          .mockReturnValueOnce(chain([]))
          .mockReturnValueOnce(chain([]))
          .mockReturnValueOnce(chain([]))
        expect((await list()).status).toBe(200)
        expect((await detail()).status).toBe(200)
        expect((await occupancy()).status).toBe(200)
        expect((await filters()).status).toBe(200)
      }
    })
  })

  describe('GET /staff/bookings (AC2, AC3)', () => {
    beforeEach(() => mocks.getSession.mockResolvedValue(operationsSession))

    it('defaults to upcoming bookings, returns a fixed projection and paginates', async () => {
      const count = chain([{ count: 2 }])
      const rows = chain([listRow, legacyListRow])
      mocks.select.mockReturnValueOnce(count).mockReturnValueOnce(rows)

      const res = await list()
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        items: [
          {
            id: BOOKING_ID,
            reference: 'bkg_staff_1',
            status: 'confirmed',
            customerName: 'Ahmed',
            customerEmail: 'ahmed@example.com',
            filmTitle: 'فيلم الاختبار',
            serviceName: null,
            startsAt: STARTS_AT.toISOString(),
            auditoriumName: 'القاعة ١',
            seatCount: 2,
            unitPricePiastres: 2500,
            totalPiastres: 5000,
            cancelledAt: null,
          },
          {
            id: '77777777-7777-4777-8777-777777777778',
            reference: 'bkg_legacy',
            status: 'confirmed',
            customerName: 'Legacy',
            customerEmail: 'ahmed@example.com',
            filmTitle: null,
            serviceName: 'Haircut',
            startsAt: '2026-12-02T10:00:00.000Z',
            auditoriumName: null,
            seatCount: null,
            unitPricePiastres: null,
            totalPiastres: null,
            cancelledAt: null,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      })
      expect(compiledSql(rows, 'where').params).toContain(NOW.toISOString())
      expect(compiledSql(rows, 'orderBy').sql).toContain('coalesce')
      expect(rows.calls.limit[0][0]).toBe(20)
      expect(rows.calls.offset[0][0]).toBe(0)
    })

    it('returns the requested slice with the same total for an out-of-range page', async () => {
      const rows = chain([])
      mocks.select
        .mockReturnValueOnce(chain([{ count: 3 }]))
        .mockReturnValueOnce(rows)
      const res = await app.request('/staff/bookings?page=99')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ items: [], total: 3, page: 99, pageSize: 20, pageCount: 1 })
      expect(rows.calls.offset[0][0]).toBe(1960)
    })

    it('applies every filter as SQL and keeps pagination in the query', async () => {
      const rows = chain([listRow])
      mocks.select.mockReturnValueOnce(chain([{ count: 1 }])).mockReturnValueOnce(rows)
      const query = new URLSearchParams({
        reference: 'ahmad',
        filmId: FILM_ID,
        showtimeId: SHOWTIME_ID,
        status: 'cancelled',
        period: 'all',
        page: '2',
        pageSize: '10',
      })
      const filtered = await app.request(`/staff/bookings?${query}`)
      expect(filtered.status).toBe(200)
      const sql = compiledSql(rows, 'where')
      expect(sql.sql).toContain('ilike')
      expect(sql.sql).toContain('"film_id"')
      expect(sql.sql).toContain('"showtime_id"')
      expect(sql.sql).toContain('"status"')
      expect(sql.params).toContain('%ahmad%')
      expect(sql.params).toContain(FILM_ID)
      expect(sql.params).toContain(SHOWTIME_ID)
      expect(sql.params).toContain('cancelled')
      expect(rows.calls.limit[0][0]).toBe(10)
      expect(rows.calls.offset[0][0]).toBe(10)
    })

    it.each([
      '/staff/bookings?filmId=not-a-uuid',
      '/staff/bookings?page=0',
      '/staff/bookings?pageSize=101',
      `/staff/bookings?reference=${'x'.repeat(121)}`,
    ])('rejects invalid query %s before any database read', async (path) => {
      const res = await app.request(path)
      expect(res.status).toBe(400)
      expect(mocks.select).not.toHaveBeenCalled()
    })
  })

  describe('GET /staff/bookings/:id (AC4)', () => {
    beforeEach(() => mocks.getSession.mockResolvedValue(adminSession))

    it('returns frozen cinema details with attribution and no credential', async () => {
      mocks.select.mockReturnValueOnce(chain([detailRow]))
      const res = await detail()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        id: BOOKING_ID,
        reference: 'bkg_staff_1',
        status: 'cancelled',
        customerName: 'Ahmed',
        customerEmail: 'ahmed@example.com',
        cancelledAt: '2026-11-27T11:00:00.000Z',
        cancelledByUserId: 'admin-1',
        cancellationReason: 'Guest request',
        guestLinkSent: true,
        guestLinkExpiresAt: '2026-12-08T16:00:00.000Z',
        filmTitle: 'فيلم الاختبار',
        startsAt: STARTS_AT.toISOString(),
        showtimeId: SHOWTIME_ID,
        showtimeStatus: 'cancelled',
        auditoriumName: 'القاعة ١',
        seatLabels: ['A1', 'A2'],
        unitPricePiastres: 2500,
        totalPiastres: 5000,
      })
      expect(JSON.stringify(body)).not.toContain('guestLinkVerifier')
      expect(JSON.stringify(body)).not.toContain('guestLinkEncrypted')
    })

    it('returns the legacy shape for a prototype row', async () => {
      mocks.select.mockReturnValueOnce(chain([{ ...detailRow, idempotencyResponse: null, serviceName: 'Haircut' }]))
      const res = await detail()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.serviceName).toBe('Haircut')
      expect(body.startsAt).toBe(NOW.toISOString())
      expect(body.seatLabels).toBeUndefined()
    })

    it('returns the same generic 404 for an unknown or malformed id', async () => {
      mocks.select.mockReturnValueOnce(chain([]))
      const unknown = await detail()
      expect(unknown.status).toBe(404)
      expect(await unknown.json()).toEqual({ error: 'booking_not_found' })
      const malformed = await detail('not-a-uuid')
      expect(malformed.status).toBe(404)
      expect(await malformed.json()).toEqual({ error: 'booking_not_found' })
      expect(mocks.select).toHaveBeenCalledTimes(1)
    })
  })

  describe('GET /staff/showtimes/:id/occupancy (AC5)', () => {
    beforeEach(() => mocks.getSession.mockResolvedValue(operationsSession))

    it('derives occupancy from the frozen layout and active claims', async () => {
      const claims = chain([{ seatId: SEAT_1 }])
      mocks.select.mockReturnValueOnce(chain([occupancyRow])).mockReturnValueOnce(claims)
      const res = await occupancy()
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        showtimeId: SHOWTIME_ID,
        filmTitle: 'فيلم الاختبار',
        startsAt: STARTS_AT.toISOString(),
        auditoriumName: 'القاعة ١',
        status: 'published',
        totalSeats: 3,
        outOfServiceSeats: 1,
        bookedSeats: 1,
        availableSeats: 1,
        occupancyPercent: 50,
      })
      // A cancelled booking's orphan claim must not be counted as booked.
      const claimSql = compiledSql(claims, 'where')
      expect(claimSql.sql).toContain('"status"')
      expect(claimSql.params).toContain('confirmed')
    })

    it('keeps a cancelled showtime readable but refuses a draft without a snapshot', async () => {
      mocks.select
        .mockReturnValueOnce(chain([{ ...occupancyRow, status: 'cancelled' as const }]))
        .mockReturnValueOnce(chain([]))
      expect((await occupancy()).status).toBe(200)
      mocks.select.mockReturnValueOnce(chain([{ ...occupancyRow, layoutSnapshot: null }]))
      const draft = await occupancy()
      expect(draft.status).toBe(409)
      expect(await draft.json()).toEqual({ error: 'showtime_not_ready' })
    })

    it('returns the same generic 404 for an unknown or malformed id', async () => {
      mocks.select.mockReturnValueOnce(chain([]))
      const unknown = await occupancy()
      expect(unknown.status).toBe(404)
      expect(await unknown.json()).toEqual({ error: 'showtime_not_found' })
      const malformed = await occupancy('bad-id')
      expect(malformed.status).toBe(404)
      expect(await malformed.json()).toEqual({ error: 'showtime_not_found' })
      expect(mocks.select).toHaveBeenCalledTimes(1)
    })
  })
})
