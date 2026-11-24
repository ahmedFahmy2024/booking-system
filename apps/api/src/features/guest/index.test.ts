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
  const getSession = vi.fn()

  return { select, from, leftJoin, where, limit, getSession }
})

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
}

function link(reference: string, token?: string): string {
  return `/guest/bookings/${reference}${token ? `?token=${encodeURIComponent(token)}` : ''}`
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
  mocks.getSession.mockResolvedValue(null)
  resetRateLimits()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-04T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('guest booking link', () => {
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
