import { canonicalCheckoutPayload } from '@booking-system/cinema-contracts'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The route resolves the database at request time; mock that boundary so the
// suite needs no DATABASE_URL and never reaches Neon.
const mocks = vi.hoisted(() => {
  const from = vi.fn()
  const innerJoin = vi.fn()
  const where = vi.fn()
  const limit = vi.fn()
  const values = vi.fn()
  return {
    select: vi.fn(),
    insert: vi.fn(),
    batch: vi.fn(),
    from,
    innerJoin,
    where,
    limit,
    values,
    claimRows: [] as Array<{ seatId: string }>,
    // Queued results for .limit(1): first call is the idempotency replay read,
    // later calls are the showtime read and any catch-block re-read.
    limitQueue: [] as unknown[][],
    showtimeResult: null as unknown[] | null,
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
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555'

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
  filmTitle: 'Cairo Nights',
  // The live name changed after publish; the frozen snapshot name must win.
  auditoriumName: 'Renamed Hall',
}

const payload = {
  showtimeId: SHOWTIME_ID,
  seatIds: [SEAT_1, SEAT_2],
  customerEmail: 'guest@example.com',
}

const storedResponse = {
  id: '33333333-3333-4333-8333-333333333333',
  reference: `bkg_${'a'.repeat(32)}`,
  showtimeId: SHOWTIME_ID,
  filmTitle: 'Cairo Nights',
  startsAt: STARTS_AT.toISOString(),
  auditoriumName: 'Hall 1',
  seatLabels: ['A1', 'A2'],
  seatIds: [SEAT_1, SEAT_2],
  unitPricePiastres: 2500,
  totalPiastres: 5000,
}

type ConfirmPayload = {
  showtimeId: string
  seatIds: string[]
  customerEmail: string
  quotedUnitPricePiastres?: number
}

function fingerprintFor(body: ConfirmPayload): string {
  return createHash('sha256').update(canonicalCheckoutPayload(body)).digest('hex')
}

function replayRow(body: ConfirmPayload = payload, response: unknown = storedResponse) {
  return {
    customerEmail: payload.customerEmail,
    idempotencyFingerprint: fingerprintFor(body),
    idempotencyResponse: response,
  }
}

function keyFor(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function post(body: unknown = payload, key: string | null = IDEMPOTENCY_KEY) {
  const queue = [...mocks.limitQueue]
  let calls = 0
  mocks.limit.mockReset()
  mocks.limit.mockImplementation(() => {
    calls += 1
    if (queue.length) return Promise.resolve(queue.shift())
    return Promise.resolve(calls === 1 ? [] : (mocks.showtimeResult ?? [showtimeRow]))
  })
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key !== null) headers['Idempotency-Key'] = key
  return app.request('/bookings/confirm', {
    method: 'POST',
    headers,
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
  mocks.limitQueue = []
  mocks.showtimeResult = null
  mocks.select.mockReturnValue({ from: mocks.from })
  // The showtime read joins films and auditoriums; the claim read stops at
  // .where(). Both builders expose .where(), and the joined one stays chainable.
  const joinable = { innerJoin: mocks.innerJoin, where: mocks.where }
  mocks.from.mockReturnValue(joinable)
  mocks.innerJoin.mockReturnValue(joinable)
  // Drizzle query builders are awaitable as well as chainable: the showtime
  // read and the replay read append .limit(), the claim read awaits .where().
  mocks.where.mockImplementation(() =>
    Object.assign(Promise.resolve(mocks.claimRows), { limit: mocks.limit }),
  )
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
      filmTitle: 'Cairo Nights',
      startsAt: STARTS_AT.toISOString(),
      auditoriumName: 'Hall 1',
      seatLabels: ['A1', 'A2'],
      seatIds: [SEAT_1, SEAT_2],
      customerEmail: payload.customerEmail,
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
        idempotencyKey: IDEMPOTENCY_KEY,
        idempotencyFingerprint: fingerprintFor(payload),
      }),
    )
    const { customerEmail: _email, ...storedOutcome } = body as Record<string, unknown>
    expect(bookingValues.idempotencyResponse).toEqual(storedOutcome)
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
    expect(JSON.stringify(bookingValues.idempotencyResponse)).not.toContain(credential!)
    expect(body).not.toHaveProperty('guestLinkVerifier')
    expect(body).not.toHaveProperty('guestLinkEncrypted')
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('replays the original outcome byte-for-byte for the same key and payload without a second write or email', async () => {
    const first = await post()
    const firstText = await first.text()
    const firstBody = JSON.parse(firstText) as Record<string, unknown>
    const [bookingValues] = mocks.values.mock.calls[0]
    mocks.limitQueue = [
      [
        {
          customerEmail: payload.customerEmail,
          idempotencyFingerprint: bookingValues.idempotencyFingerprint,
          // jsonb may return stored keys in any order; replay must normalize.
          idempotencyResponse: Object.fromEntries(
            Object.entries(firstBody)
              .filter(([name]) => name !== 'customerEmail')
              .reverse(),
          ),
        },
      ],
    ]

    const replay = await post()

    expect(replay.status).toBe(201)
    expect(await replay.text()).toBe(firstText)
    expect(mocks.batch).toHaveBeenCalledOnce()
    expect(mocks.values).toHaveBeenCalledTimes(2)
    expect(getCapturedMessages()).toHaveLength(1)
  })

  it('refuses the same key with a different payload and leaves the original booking alone', async () => {
    await post()
    const [bookingValues] = mocks.values.mock.calls[0]
    mocks.limitQueue = [
      [
        {
          customerEmail: payload.customerEmail,
          idempotencyFingerprint: bookingValues.idempotencyFingerprint,
          idempotencyResponse: storedResponse,
        },
      ],
    ]

    const conflict = await post({ ...payload, seatIds: [SEAT_1] })

    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'idempotency_key_conflict' })
    expect(mocks.batch).toHaveBeenCalledOnce()
    expect(getCapturedMessages()).toHaveLength(1)
  })

  it('does not reserve the key when a confirmation fails before the write', async () => {
    mocks.claimRows = [{ seatId: SEAT_2 }]

    const denied = await post()
    expect(denied.status).toBe(409)
    expect((await denied.json()).error).toBe('seat_unavailable')
    expect(mocks.batch).not.toHaveBeenCalled()

    mocks.claimRows = []
    expect((await post()).status).toBe(201)
    expect(mocks.batch).toHaveBeenCalledOnce()
    expect(mocks.values.mock.calls[0][0].idempotencyKey).toBe(IDEMPOTENCY_KEY)
  })

  it('replays the winner when a concurrent attempt claims the same idempotency key', async () => {
    const duplicate = new Error('duplicate key')
    ;(duplicate as Error & { code: string; constraint: string }).code = '23505'
    ;(duplicate as Error & { constraint: string }).constraint = 'bookings_idempotency_key_unique'
    mocks.batch.mockRejectedValueOnce(new Error('wrapped', { cause: duplicate }))
    mocks.limitQueue = [[], [showtimeRow], [replayRow()]]

    const res = await post()

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ...storedResponse, customerEmail: payload.customerEmail })
    expect(mocks.batch).toHaveBeenCalledOnce()
    expect(getCapturedMessages()).toHaveLength(0)
  })

  it('replays an identical retry that sees the winner’s claim after its replay read', async () => {
    // Both requests start together: the replay read misses the winner, then a
    // competing claim becomes visible before this request reads claims. The
    // same key and payload must still replay, not report a seat conflict.
    mocks.claimRows = [{ seatId: SEAT_1 }, { seatId: SEAT_2 }]
    mocks.limitQueue = [[], [showtimeRow], [replayRow()]]

    const res = await post()

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ...storedResponse, customerEmail: payload.customerEmail })
    expect(mocks.batch).not.toHaveBeenCalled()
    expect(getCapturedMessages()).toHaveLength(0)
  })

  it('replays an identical retry when a price change lands after its replay read', async () => {
    const quoted = { ...payload, quotedUnitPricePiastres: 2500 }
    const repriced = { ...showtimeRow, pricePiastres: 3000 }
    mocks.limitQueue = [[], [repriced], [replayRow(quoted)]]

    const res = await post(quoted)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ...storedResponse, customerEmail: payload.customerEmail })
    expect(mocks.batch).not.toHaveBeenCalled()
    expect(getCapturedMessages()).toHaveLength(0)
  })

  it('reports a key conflict when a racing batch loses a seat with the same key but another payload', async () => {
    const duplicate = new Error('duplicate key')
    ;(duplicate as Error & { code: string; constraint: string }).code = '23505'
    ;(duplicate as Error & { constraint: string }).constraint = 'booking_seats_showtime_seat_unique'
    mocks.batch.mockRejectedValueOnce(new Error('wrapped', { cause: duplicate }))
    const different = { ...payload, seatIds: [SEAT_1] }
    mocks.limitQueue = [[], [showtimeRow], [replayRow(different)]]

    const res = await post()

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'idempotency_key_conflict' })
    expect(getCapturedMessages()).toHaveLength(0)
  })

  it('refuses a missing or malformed idempotency key before any database work', async () => {
    const missing = await post(payload, null)
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'invalid_idempotency_key' })

    const malformed = await post(payload, 'not-a-uuid')
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toEqual({ error: 'invalid_idempotency_key' })
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it('returns frozen seat labels in the requested order for the confirmation screen', async () => {
    const res = await post({ ...payload, seatIds: [SEAT_2, SEAT_1] })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.seatLabels).toEqual(['A2', 'A1'])
    expect(body.auditoriumName).toBe('Hall 1')
    expect(body.filmTitle).toBe('Cairo Nights')
    expect(JSON.stringify(body)).not.toContain('Renamed Hall')
  })

  it('falls back to the live auditorium name when the frozen snapshot has none', async () => {
    mocks.showtimeResult = [
      { ...showtimeRow, layoutSnapshot: { ...snapshot, auditoriumName: '' } },
    ]

    const res = await post()

    expect(res.status).toBe(201)
    expect((await res.json()).auditoriumName).toBe('Renamed Hall')
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
    // A malformed body is rejected by the JSON validator before the replay read.
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
    mocks.showtimeResult = []

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
    mocks.showtimeResult = [{ ...showtimeRow, ...overrides }]

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
    const denied = await post({ ...payload, seatIds: [seatId] })
    expect(denied.status).toBe(400)
    expect(await denied.json()).toEqual({ error: 'invalid_seat' })
    expect(mocks.batch).not.toHaveBeenCalled()

    expect((await post({ ...payload, seatIds: [SEAT_1] })).status).toBe(201)
    expect(mocks.batch).toHaveBeenCalledOnce()
  })

  it.each([undefined, 'booking_seats_showtime_seat_unique'])(
    'maps a losing seat claim (%s) to a generic conflict with no email and no partial write',
    async (constraint) => {
      const conflict = new Error('duplicate key')
      ;(conflict as Error & { code: string }).code = '23505'
      if (constraint) (conflict as Error & { constraint: string }).constraint = constraint
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
    },
  )

  it('rate-limits repeated confirmation attempts after the shared checkout budget', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect((await post(payload, keyFor(attempt))).status).toBe(201)
    }
    const res = await post(payload, keyFor(30))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too_many_requests' })
    expect(mocks.batch).toHaveBeenCalledTimes(30)
  })
})
