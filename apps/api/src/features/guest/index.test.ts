import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimits } from '../../rate-limit.js'
import {
  createGuestCredential,
  guestLinkExpiresAt,
  guestLinkVerifier,
} from './credentials.js'

// The guest route needs a database but no staff session. Mock the DB chain and
// auth boundary so the suite runs without DATABASE_URL or a live connection.
const mocks = vi.hoisted(() => {
  const select = vi.fn()
  const from = vi.fn()
  const leftJoin = vi.fn()
  const where = vi.fn()
  const limit = vi.fn()
  const update = vi.fn()
  const set = vi.fn()
  const updateWhere = vi.fn()
  const remove = vi.fn()
  const deleteWhere = vi.fn()
  const batch = vi.fn()
  const getSession = vi.fn()

  return {
    select, from, leftJoin, where, limit,
    update, set, updateWhere, remove, deleteWhere, batch, getSession,
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
  getDb: () => ({
    select: mocks.select,
    update: mocks.update,
    delete: mocks.remove,
    batch: mocks.batch,
  }),
}))

import { app } from '../../app.js'

const startsAt = new Date('2026-12-01T10:00:00.000Z')
const expiry = guestLinkExpiresAt(startsAt)
const referenceA = `bkg_${'a'.repeat(32)}`
const referenceB = `bkg_${'b'.repeat(32)}`
const credentialA = `gl_${'A'.repeat(43)}`
const credentialB = `gl_${'B'.repeat(43)}`

const rowA = {
  id: '11111111-1111-4111-8111-111111111111',
  reference: referenceA,
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  startsAt,
  serviceName: 'Haircut',
  status: 'confirmed',
  guestLinkVerifier: guestLinkVerifier(credentialA),
  guestLinkExpiresAt: expiry,
}

const rowB = {
  id: '22222222-2222-4222-8222-222222222222',
  reference: referenceB,
  customerName: 'Fatma',
  customerEmail: 'fatma@example.com',
  startsAt,
  serviceName: 'Haircut',
  status: 'confirmed',
  guestLinkVerifier: guestLinkVerifier(credentialB),
  guestLinkExpiresAt: expiry,
}

const detailA = {
  id: rowA.id,
  reference: referenceA,
  customerName: rowA.customerName,
  customerEmail: rowA.customerEmail,
  startsAt: startsAt.toISOString(),
  serviceName: rowA.serviceName,
  status: 'confirmed',
  canCancel: false,
}

/** A cinema booking: the frozen confirmation outcome is the authoritative detail. */
const cinemaRow = {
  ...rowA,
  customerName: 'guest-cinema@example.com',
  customerEmail: 'guest-cinema@example.com',
  serviceName: null,
  idempotencyResponse: {
    id: rowA.id,
    reference: referenceA,
    showtimeId: '33333333-3333-4333-8333-333333333333',
    filmTitle: 'Cairo Nights',
    startsAt: startsAt.toISOString(),
    auditoriumName: 'Hall 1',
    seatLabels: ['A1', 'A2'],
    seatIds: [
      'aaaa0000-0000-4000-8000-000000000001',
      'aaaa0000-0000-4000-8000-000000000002',
    ],
    unitPricePiastres: 2500,
    totalPiastres: 5000,
    // A malformed/stale snapshot must not be reflected verbatim.
    internal_only: 'must-not-leak',
  },
}

const cinemaDetail = {
  id: cinemaRow.id,
  reference: referenceA,
  showtimeId: cinemaRow.idempotencyResponse.showtimeId,
  filmTitle: 'Cairo Nights',
  startsAt: startsAt.toISOString(),
  auditoriumName: 'Hall 1',
  seatLabels: ['A1', 'A2'],
  seatIds: cinemaRow.idempotencyResponse.seatIds,
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  customerEmail: 'guest-cinema@example.com',
  status: 'confirmed',
  canCancel: false,
}

/** A future showtime makes the two-hour cancellation window open at fake now. */
const cancelStartsAt = new Date('2026-12-05T10:00:00.000Z')
const cancelCinemaRow = {
  ...cinemaRow,
  startsAt: cancelStartsAt,
  guestLinkExpiresAt: guestLinkExpiresAt(cancelStartsAt),
  idempotencyResponse: {
    ...cinemaRow.idempotencyResponse,
    startsAt: cancelStartsAt.toISOString(),
  },
}

function link(reference: string, token?: string): string {
  return `/guest/bookings/${reference}${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

async function cancel(reference: string, token?: string) {
  return app.request(`/guest/bookings/${reference}/cancel`, {
    method: 'POST',
    headers: token ? { 'x-guest-token': token } : {},
  })
}

function expectGenericDenial(res: Response) {
  expect(res.status).toBe(404)
  expect(res.headers.get('Cache-Control')).toBe('no-store')
  expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.select.mockReturnValue({ from: mocks.from })
  mocks.from.mockReturnValue({ leftJoin: mocks.leftJoin })
  mocks.leftJoin.mockReturnValue({ where: mocks.where })
  mocks.where.mockReturnValue({ limit: mocks.limit })
  mocks.limit.mockResolvedValue([])
  mocks.update.mockReturnValue({ set: mocks.set })
  mocks.set.mockReturnValue({ where: mocks.updateWhere })
  mocks.updateWhere.mockReturnValue({})
  mocks.remove.mockReturnValue({ where: mocks.deleteWhere })
  mocks.deleteWhere.mockReturnValue({})
  mocks.batch.mockResolvedValue(undefined)
  mocks.getSession.mockResolvedValue(null)
  resetRateLimits()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-04T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('guest booking link read', () => {
  it('returns read-only detail for a valid unexpired credential without leaking it', async () => {
    mocks.limit.mockResolvedValueOnce([rowA])
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await app.request(link(referenceA, credentialA))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(detailA)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(JSON.stringify(body)).not.toContain(credentialA)
    expect(JSON.stringify(body)).not.toContain(rowA.guestLinkVerifier!)
    for (const [name, value] of res.headers) {
      expect(value).not.toContain(credentialA)
      expect(name).not.toContain(credentialA)
    }
    const logged = [log, info, warn, error].flatMap((spy) => spy.mock.calls.flat().map(String)).join(' ')
    expect(logged).not.toContain(credentialA)
  })

  it('accepts a base64url reference containing - and _', async () => {
    const reference = `bkg_${'a'.repeat(30)}-_`
    mocks.limit.mockResolvedValueOnce([{ ...rowA, reference }])

    const res = await app.request(link(reference, credentialA))

    expect(res.status).toBe(200)
    expect((await res.json()).reference).toBe(reference)
  })

  it('gives an invalid token the same generic denial as every other failure', async () => {
    mocks.limit.mockResolvedValueOnce([rowA])

    const res = await app.request(link(referenceA, createGuestCredential()))
    const body = await res.json()

    expectGenericDenial(res)
    expect(body).toEqual({ error: 'guest_link_invalid' })
    expect(JSON.stringify(body)).not.toContain(rowA.customerEmail)
  })

  it('denies a token one second after the exact seven-day expiry', async () => {
    vi.setSystemTime(new Date(expiry.getTime() + 1000))
    mocks.limit.mockResolvedValueOnce([rowA])

    const res = await app.request(link(referenceA, credentialA))

    expectGenericDenial(res)
    expect(await res.json()).toEqual({ error: 'guest_link_invalid' })
  })

  it('accepts the credential at the exact seven-day instant', async () => {
    vi.setSystemTime(expiry)
    mocks.limit.mockResolvedValueOnce([rowA])

    const res = await app.request(link(referenceA, credentialA))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(detailA)
  })

  it('denies a credential issued for a different booking', async () => {
    mocks.limit.mockResolvedValueOnce([rowB])

    const res = await app.request(link(referenceB, credentialA))
    const body = await res.json()

    expectGenericDenial(res)
    expect(body).toEqual({ error: 'guest_link_invalid' })
    expect(JSON.stringify(body)).not.toContain(rowB.customerEmail)
  })

  it('denies a reference-only request without reading the database', async () => {
    const res = await app.request(link(referenceA))
    const body = await res.json()

    expectGenericDenial(res)
    expect(body).toEqual({ error: 'guest_link_invalid' })
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('returns the frozen cinema details without any credential material', async () => {
    mocks.limit.mockResolvedValueOnce([cinemaRow])
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await app.request(link(referenceA, credentialA))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(cinemaDetail)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain(credentialA)
    expect(serialized).not.toContain(rowA.guestLinkVerifier!)
    expect(serialized).not.toContain('must-not-leak')
    expect(error).not.toHaveBeenCalled()
  })

  it('reveals no contact details when only the reference is known for a cinema booking', async () => {
    const res = await app.request(link(referenceA))
    const body = await res.json()

    expectGenericDenial(res)
    expect(body).toEqual({ error: 'guest_link_invalid' })
    expect(JSON.stringify(body)).not.toContain(cinemaDetail.customerEmail)
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('gives a wrong token the same generic denial for a cinema booking', async () => {
    mocks.limit.mockResolvedValueOnce([cinemaRow])

    const res = await app.request(link(referenceA, credentialB))
    const body = await res.json()

    expectGenericDenial(res)
    expect(body).toEqual({ error: 'guest_link_invalid' })
    expect(JSON.stringify(body)).not.toContain(cinemaDetail.customerEmail)
    expect(JSON.stringify(body)).not.toContain(cinemaDetail.filmTitle)
  })

  it('rate-limits repeated guest-link attempts with a generic response', async () => {
    mocks.limit.mockResolvedValue([rowA])

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await app.request(link(referenceA, credentialA))).status).toBe(200)
    }

    const res = await app.request(link(referenceA, credentialA))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too_many_requests' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.select).toHaveBeenCalledTimes(20)
  })
})

describe('guest cancellation write', () => {
  it('changes status and releases every claim in one transaction without echoing the token', async () => {
    mocks.limit.mockResolvedValueOnce([cancelCinemaRow])
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await cancel(referenceA, credentialA)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      ...cinemaDetail,
      startsAt: cancelStartsAt.toISOString(),
      status: 'cancelled',
      canCancel: false,
    })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(JSON.stringify(body)).not.toContain(credentialA)
    expect(JSON.stringify(body)).not.toContain('must-not-leak')
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    expect(mocks.batch.mock.calls[0][0]).toHaveLength(2)
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', cancelledAt: expect.any(Date) }),
    )
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    const logged = [...log.mock.calls, ...error.mock.calls].flat().map(String).join(' ')
    expect(logged).not.toContain(credentialA)
  })

  it('refuses at the exact two-hour cutoff and accepts one millisecond before it', async () => {
    const cutoff = new Date(cancelStartsAt.getTime() - 120 * 60_000)
    mocks.limit.mockResolvedValueOnce([cancelCinemaRow])
    vi.setSystemTime(cutoff)

    const atCutoff = await cancel(referenceA, credentialA)
    expect(atCutoff.status).toBe(409)
    expect(await atCutoff.json()).toEqual({ error: 'cancellation_closed' })
    expect(mocks.batch).not.toHaveBeenCalled()

    vi.setSystemTime(new Date(cutoff.getTime() - 1))
    mocks.limit.mockResolvedValueOnce([cancelCinemaRow])
    const beforeCutoff = await cancel(referenceA, credentialA)
    expect(beforeCutoff.status).toBe(200)
    expect(mocks.batch).toHaveBeenCalledTimes(1)
  })

  it('treats a repeated cancellation as a no-op with the same cancelled detail', async () => {
    mocks.limit.mockResolvedValue([{ ...cancelCinemaRow, status: 'cancelled' }])

    const first = await cancel(referenceA, credentialA)
    const second = await cancel(referenceA, credentialA)
    const expected = {
      ...cinemaDetail,
      startsAt: cancelStartsAt.toISOString(),
      status: 'cancelled',
      canCancel: false,
    }

    expect(first.status).toBe(200)
    expect(await first.json()).toEqual(expected)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual(expected)
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it('cancels a legacy booking that has no frozen snapshot', async () => {
    mocks.limit.mockResolvedValueOnce([{ ...rowA, startsAt: cancelStartsAt, guestLinkExpiresAt: guestLinkExpiresAt(cancelStartsAt) }])

    const res = await cancel(referenceA, credentialA)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...detailA, startsAt: cancelStartsAt.toISOString(), status: 'cancelled', canCancel: false })
    expect(mocks.batch).toHaveBeenCalledTimes(1)
  })

  it('gives every invalid credential the same denial and writes nothing', async () => {
    const noToken = await cancel(referenceA)
    expectGenericDenial(noToken)
    expect(await noToken.json()).toEqual({ error: 'guest_link_invalid' })
    expect(mocks.select).not.toHaveBeenCalled()

    for (const [row, token] of [[rowA, credentialB], [rowB, credentialA]] as const) {
      mocks.limit.mockResolvedValueOnce([row])
      const res = await (row.reference === referenceA
        ? cancel(referenceA, token)
        : cancel(referenceB, token))
      expectGenericDenial(res)
      expect(await res.json()).toEqual({ error: 'guest_link_invalid' })
    }

    vi.setSystemTime(new Date(expiry.getTime() + 1000))
    mocks.limit.mockResolvedValueOnce([rowA])
    const expired = await cancel(referenceA, credentialA)
    expectGenericDenial(expired)
    expect(mocks.batch).not.toHaveBeenCalled()
    expect(mocks.select).toHaveBeenCalledTimes(3)
  })

  it('shares the guest rate limiter with the detail read', async () => {
    mocks.limit.mockResolvedValue([cancelCinemaRow])

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await cancel(referenceA, credentialA)).status).toBe(200)
    }

    const res = await cancel(referenceA, credentialA)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'too_many_requests' })
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(mocks.select).toHaveBeenCalledTimes(20)
  })
})
