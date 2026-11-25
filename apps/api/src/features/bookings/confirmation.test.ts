import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The route resolves the database at request time; mock that boundary so the
// suite needs no DATABASE_URL and never reaches Neon.
const mocks = vi.hoisted(() => {
  const from = vi.fn()
  const where = vi.fn()
  const limit = vi.fn()
  const values = vi.fn()
  return {
    select: vi.fn(),
    insert: vi.fn(),
    batch: vi.fn(),
    from,
    where,
    limit,
    values,
    claimRows: [] as Array<{ seatId: string }>,
    getSession: vi.fn(),
  }
})

vi.mock('../../auth.js', () => ({
  webUrl: 'http://localhost:5173',
  auth: {
    api: { getSession: mocks.getSession },
    handler: vi.fn(),
  },
}))

vi.mock('../../db/index.js', () => ({
  getDb: () => ({ select: mocks.select, insert: mocks.insert, batch: mocks.batch }),
}))

import { app } from '../../app.js'
import { clearCapturedMessages, getCapturedMessages } from '../mail/index.js'
import { resetRateLimits } from '../../rate-limit.js'
import {
  decryptGuestCredential,
  guestLinkExpiresAt,
  verifyGuestLinkVerifier,
} from '../guest/credentials.js'

const NOW = new Date('2026-11-23T12:00:00.000Z')
const SHOWTIME_ID = '44444444-4444-4444-8444-444444444444'
const AUDITORIUM_ID = '22222222-2222-4222-8222-222222222222'
const STARTS_AT = new Date('2026-12-01T10:00:00.000Z')
const SEAT_1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const SEAT_2 = 'aaaaaaaa-0000-4000-8000-000000000002'
const OTHER_SEAT = 'aaaaaaaa-0000-4000-8000-000000000003'

const snapshot = {
  auditoriumId: AUDITORIUM_ID,
  auditoriumName: 'Hall 1',
  seats: [
    { id: SEAT_1, rowLabel: 'A', seatNumber: 1, aisleAfter: false, outOfService: false },
    { id: SEAT_2, rowLabel: 'A', seatNumber: 2, aisleAfter: false, outOfService: false },
    { id: OTHER_SEAT, rowLabel: 'A', seatNumber: 3, aisleAfter: false, outOfService: true },
  ],
}

const showtimeRow = {
  id: SHOWTIME_ID,
  auditoriumId: AUDITORIUM_ID,
  startsAt: STARTS_AT,
  status: 'published',
  pricePiastres: 2500,
  layoutSnapshot: snapshot,
}

const payload = {
  showtimeId: SHOWTIME_ID,
  seatIds: [SEAT_1, SEAT_2],
  customerEmail: 'guest@example.com',
}

function post(body: unknown = payload) {
  return app.request('/bookings/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.resetAllMocks()
  resetRateLimits()
  clearCapturedMessages()
  mocks.claimRows = []
  mocks.select.mockReturnValue({ from: mocks.from })
  mocks.from.mockReturnValue({ where: mocks.where })
  // Drizzle query builders are awaitable as well as chainable: the showtime
  // read appends .limit(), the claim read awaits the same thenable.
  mocks.where.mockImplementation(() =>
    Object.assign(Promise.resolve(mocks.claimRows), { limit: mocks.limit }),
  )
  mocks.limit.mockResolvedValue([showtimeRow])
  mocks.insert.mockReturnValue({ values: mocks.values })
  mocks.values.mockReturnValue({})
  mocks.batch.mockResolvedValue([[], []])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /bookings/confirm — atomic cinema checkout', () => {
  it('claims every selected seat in one transaction and returns only public booking fields', async () => {
    const res = await post()
    const body = await res.json()
    const [bookingValues] = mocks.values.mock.calls[0]
    const claimValues = mocks.values.mock.calls[1][0]
    const emails = getCapturedMessages()

    expect(res.status).toBe(201)
    expect(body).toEqual({
      id: bookingValues.id,
      reference: bookingValues.reference,
      showtimeId: SHOWTIME_ID,
      seatIds: [SEAT_1, SEAT_2],
      customerEmail: payload.customerEmail,
      startsAt: STARTS_AT.toISOString(),
      unitPricePiastres: 2500,
      totalPiastres: 5000,
    })
    expect(bookingValues).toEqual(
      expect.objectContaining({
        customerName: payload.customerEmail,
        customerEmail: payload.customerEmail,
        startsAt: STARTS_AT,
        showtimeId: SHOWTIME_ID,
        unitPricePiastres: 2500,
        totalPiastres: 5000,
        guestLinkExpiresAt: guestLinkExpiresAt(STARTS_AT),
      }),
    )
    expect(bookingValues.reference).toMatch(/^bkg_[A-Za-z0-9_-]{32}$/)
    expect(claimValues).toEqual([
      { bookingId: bookingValues.id, showtimeId: SHOWTIME_ID, seatId: SEAT_1 },
      { bookingId: bookingValues.id, showtimeId: SHOWTIME_ID, seatId: SEAT_2 },
    ])
    expect(mocks.batch).toHaveBeenCalledOnce()
    expect(mocks.values).toHaveBeenCalledTimes(2)

    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe(payload.customerEmail)
    expect(emails[0].kind).toBe('guest-link')
    const credential = emails[0].text.match(/token=(gl_[A-Za-z0-9_-]+)/)?.[1]
    expect(credential).toBeDefined()
    expect(verifyGuestLinkVerifier(bookingValues.guestLinkVerifier, credential!)).toBe(true)
    expect(decryptGuestCredential(bookingValues.guestLinkEncrypted)).toBe(credential)
    expect(JSON.stringify(body)).not.toContain(credential!)
    expect(body).not.toHaveProperty('guestLinkVerifier')
    expect(body).not.toHaveProperty('guestLinkEncrypted')
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('refuses malformed payloads before any database work', async () => {
    const invalid = [
      { ...payload, seatIds: [] },
      { ...payload, seatIds: Array.from({ length: 7 }, (_, i) => `${i}`) },
      { ...payload, seatIds: [SEAT_1, SEAT_1] },
      { ...payload, showtimeId: 'not-a-uuid' },
      { ...payload, customerEmail: 'not-an-email' },
      { ...payload, quotedUnitPricePiastres: 0 },
      { ...payload, quotedUnitPricePiastres: '2500' },
    ]

    for (const body of invalid) {
      expect((await post(body)).status).toBe(400)
    }
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it('books at the reviewed unit price when it still matches', async () => {
    const res = await post({ ...payload, quotedUnitPricePiastres: 2500 })

    expect(res.status).toBe(201)
    expect((await res.json()).unitPricePiastres).toBe(2500)
    expect(mocks.batch).toHaveBeenCalledOnce()
  })

  it('asks the guest to confirm a revised total before writing', async () => {
    const revised = { ...payload, quotedUnitPricePiastres: 2000 }

    const conflict = await post(revised)
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({
      error: 'price_changed',
      unitPricePiastres: 2500,
      availableSeatIds: [SEAT_1, SEAT_2],
    })
    expect(mocks.batch).not.toHaveBeenCalled()
    expect(getCapturedMessages()).toHaveLength(0)

    expect((await post({ ...revised, quotedUnitPricePiastres: 2500 })).status).toBe(201)
    expect(mocks.batch).toHaveBeenCalledOnce()
  })

  it('returns the still-available subset when a requested seat was taken', async () => {
    mocks.claimRows = [{ seatId: SEAT_2 }]

    const conflict = await post()
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({
      error: 'seat_unavailable',
      unitPricePiastres: 2500,
      availableSeatIds: [SEAT_1],
    })
    expect(mocks.batch).not.toHaveBeenCalled()
    expect(getCapturedMessages()).toHaveLength(0)

    expect((await post({ ...payload, seatIds: [SEAT_1] })).status).toBe(201)
    expect(mocks.batch).toHaveBeenCalledOnce()
  })

  it('refuses at the exact 15-minute cutoff and accepts one millisecond before it', async () => {
    vi.setSystemTime(new Date(STARTS_AT.getTime() - 15 * 60_000))
    const denied = await post()
    expect(denied.status).toBe(409)
    expect(await denied.json()).toEqual({ error: 'booking_closed' })
    expect(mocks.batch).not.toHaveBeenCalled()

    mocks.batch.mockClear()
    vi.setSystemTime(new Date(STARTS_AT.getTime() - 15 * 60_000 - 1))
    expect((await post()).status).toBe(201)
    expect(mocks.batch).toHaveBeenCalledOnce()
  })

  it('denies an unknown showtime before writing', async () => {
    mocks.limit.mockResolvedValueOnce([])

    const res = await post({ ...payload, showtimeId: '66666666-6666-4666-8666-666666666666' })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'showtime_not_found' })
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it.each([
    ['a draft showtime', { status: 'draft' }, 404, 'showtime_not_found'],
    ['a cancelled showtime', { status: 'cancelled' }, 404, 'showtime_not_found'],
    ['a missing snapshot', { layoutSnapshot: null }, 409, 'seat_map_unavailable'],
    ['a zero price', { pricePiastres: 0 }, 409, 'price_unavailable'],
  ])('denies %s before writing', async (_label, overrides, status, error) => {
    mocks.limit.mockResolvedValueOnce([{ ...showtimeRow, ...overrides }])

    const res = await post()

    expect(res.status).toBe(status)
    expect(await res.json()).toEqual({ error })
    expect(mocks.batch).not.toHaveBeenCalled()
    expect(getCapturedMessages()).toHaveLength(0)
  })

  it.each([
    ['a seat outside the frozen layout', 'bbbbbbbb-0000-4000-8000-000000000009'],
    ['an out-of-service seat', OTHER_SEAT],
  ])('refuses %s and lets a corrected selection retry', async (_label, seatId) => {
    mocks.limit.mockResolvedValueOnce([showtimeRow])

    const denied = await post({ ...payload, seatIds: [seatId] })
    expect(denied.status).toBe(400)
    expect(await denied.json()).toEqual({ error: 'invalid_seat' })
    expect(mocks.batch).not.toHaveBeenCalled()

    expect((await post({ ...payload, seatIds: [SEAT_1] })).status).toBe(201)
    expect(mocks.batch).toHaveBeenCalledOnce()
  })

  it('maps a losing seat claim to a generic conflict with no email and no partial write', async () => {
    const conflict = new Error('duplicate key')
    ;(conflict as Error & { code: string }).code = '23505'
    mocks.batch.mockRejectedValueOnce(new Error('wrapped', { cause: conflict }))

    const res = await post()

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'seat_unavailable',
      unitPricePiastres: 2500,
      availableSeatIds: [SEAT_1, SEAT_2],
    })
    expect(getCapturedMessages()).toHaveLength(0)
    expect(mocks.batch).toHaveBeenCalledOnce()
    expect(mocks.values).toHaveBeenCalledTimes(2)
  })

  it('rate-limits repeated confirmation attempts after the shared checkout budget', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect((await post()).status).toBe(201)
    }
    const res = await post()
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too_many_requests' })
    expect(mocks.batch).toHaveBeenCalledTimes(30)
  })
})
