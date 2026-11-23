import { beforeEach, describe, expect, it, vi } from 'vitest'

// The route calls getDb() at request time and requireStaff calls
// auth.api.getSession(). Mock both boundaries so tests need no DATABASE_URL and
// never reach Neon. vi.hoisted runs before vi.mock is hoisted.
const mocks = vi.hoisted(() => {
  const innerJoin = vi.fn()
  const from = vi.fn()
  const returning = vi.fn()
  const values = vi.fn()
  const getSession = vi.fn()
  const where = vi.fn()
  const limit = vi.fn()
  const update = vi.fn()
  const set = vi.fn()

  return {
    select: vi.fn(),
    insert: vi.fn(),
    innerJoin,
    from,
    values,
    returning,
    getSession,
    where,
    limit,
    update,
    set,
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
  getDb: () => ({ select: mocks.select, insert: mocks.insert, update: mocks.update }),
}))

import { app } from '../../app.js'
import { clearCapturedMessages, getCapturedMessages } from '../mail/index.js'
import { resetRateLimits } from '../../rate-limit.js'
import {
  decryptGuestCredential,
  encryptGuestCredential,
  guestLinkExpiresAt,
  guestLinkVerifier,
  verifyGuestLinkVerifier,
} from '../guest/credentials.js'

const validPayload = {
  serviceId: 1,
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  startsAt: '2026-12-01T10:00:00.000Z',
}

const operationsSession = {
  user: { id: 'ops-1', role: 'operations' },
  session: { id: 'session-ops' },
}

const adminSession = {
  user: { id: 'admin-1', role: 'admin' },
  session: { id: 'session-admin' },
}

const bannedOperationsSession = {
  user: { id: 'ops-2', role: 'operations', banned: true },
  session: { id: 'session-banned-ops' },
}

const bannedAdminSession = {
  user: { id: 'admin-2', role: 'admin', banned: true },
  session: { id: 'session-banned-admin' },
}

const wrongRoleSession = {
  user: { id: 'guest-1', role: 'customer' },
  session: { id: 'session-guest' },
}

const storedBooking = {
  id: '11111111-1111-4111-8111-111111111111',
  customerName: validPayload.customerName,
  customerEmail: validPayload.customerEmail,
  startsAt: new Date(validPayload.startsAt),
  serviceName: 'Haircut',
}

const listedBooking = { ...storedBooking, startsAt: validPayload.startsAt }

function expectNoBookingFields(body: unknown) {
  const text = JSON.stringify(body)
  expect(text).not.toContain('customerName')
  expect(text).not.toContain('customerEmail')
  expect(text).not.toContain(validPayload.customerEmail)
}

beforeEach(() => {
  vi.resetAllMocks()
  resetRateLimits()
  clearCapturedMessages()
  mocks.select.mockReturnValue({ from: mocks.from })
  mocks.insert.mockReturnValue({ values: mocks.values })
  mocks.from.mockReturnValue({ innerJoin: mocks.innerJoin, where: mocks.where })
  mocks.values.mockReturnValue({ returning: mocks.returning })
  mocks.innerJoin.mockResolvedValue([])
  mocks.where.mockReturnValue({ limit: mocks.limit })
  mocks.limit.mockResolvedValue([])
  mocks.update.mockReturnValue({ set: mocks.set })
  mocks.set.mockReturnValue({ where: mocks.where })
})

function listBookings() {
  return app.request('/bookings')
}

describe('bookings routes', () => {
  describe('GET /bookings — staff booking list', () => {
    it('refuses a request with no session without reading any booking', async () => {
      mocks.getSession.mockResolvedValue(null)

      const res = await listBookings()
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body).toEqual({ error: 'authentication_required' })
      expectNoBookingFields(body)
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it('allows operations staff and keeps the existing response contract', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.innerJoin.mockResolvedValueOnce([storedBooking])

      const res = await listBookings()

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([listedBooking])
    })

    it('allows an admin and keeps the existing response contract', async () => {
      mocks.getSession.mockResolvedValue(adminSession)
      mocks.innerJoin.mockResolvedValueOnce([storedBooking])

      const res = await listBookings()

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([listedBooking])
    })

    it.each([
      ['operations', bannedOperationsSession],
      ['admin', bannedAdminSession],
    ])('refuses a deactivated %s account even if its session was not revoked', async (_role, session) => {
      mocks.getSession.mockResolvedValue(session)

      const res = await listBookings()
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body).toEqual({ error: 'staff_account_inactive' })
      expectNoBookingFields(body)
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it('refuses a session whose role is outside the permission matrix', async () => {
      mocks.getSession.mockResolvedValue(wrongRoleSession)

      const res = await listBookings()
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body).toEqual({ error: 'forbidden' })
      expectNoBookingFields(body)
      expect(mocks.select).not.toHaveBeenCalled()
    })
  })

  describe('POST /bookings — public guest creation and first link (B2.4)', () => {
    it('creates a booking with a reference, stores only a verifier and emails the private link', async () => {
      mocks.returning.mockImplementation(async () => [
        {
          id: '22222222-2222-4222-8222-222222222222',
          serviceId: validPayload.serviceId,
          customerName: validPayload.customerName,
          customerEmail: validPayload.customerEmail,
          startsAt: validPayload.startsAt,
          reference: mocks.values.mock.calls[0][0].reference,
        },
      ])
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      const res = await app.request('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      })
      const body = await res.json()
      const inserted = mocks.values.mock.calls[0][0]
      const emails = getCapturedMessages()

      expect(res.status).toBe(201)
      expect(body).toEqual({
        id: '22222222-2222-4222-8222-222222222222',
        serviceId: validPayload.serviceId,
        customerName: validPayload.customerName,
        customerEmail: validPayload.customerEmail,
        startsAt: validPayload.startsAt,
        reference: inserted.reference,
      })
      expect(inserted).toEqual(
        expect.objectContaining({
          serviceId: validPayload.serviceId,
          customerName: validPayload.customerName,
          customerEmail: validPayload.customerEmail,
          startsAt: new Date(validPayload.startsAt),
        }),
      )
      expect(inserted.reference).toMatch(/^bkg_[A-Za-z0-9_-]{32}$/)
      expect(inserted.guestLinkVerifier).toMatch(/^[0-9a-f]{64}$/)
      expect(inserted.guestLinkExpiresAt).toEqual(
        guestLinkExpiresAt(new Date(validPayload.startsAt)),
      )

      expect(emails).toHaveLength(1)
      expect(emails[0].to).toBe(validPayload.customerEmail)
      expect(emails[0].kind).toBe('guest-link')
      const credential = emails[0].text.match(/token=(gl_[A-Za-z0-9_-]+)/)?.[1]
      expect(credential).toBeDefined()
      expect(verifyGuestLinkVerifier(inserted.guestLinkVerifier, credential!)).toBe(true)
      expect(decryptGuestCredential(inserted.guestLinkEncrypted)).toBe(credential)

      expect(JSON.stringify(body)).not.toContain(credential!)
      expect(body).not.toHaveProperty('guestLinkVerifier')
      expect(body).not.toHaveProperty('guestLinkEncrypted')
      expect(body).not.toHaveProperty('guestLinkExpiresAt')
      const logged = [log, info, warn, error].flatMap((spy) => spy.mock.calls.flat().map(String)).join(' ')
      expect(logged).not.toContain(credential!)
      expect(mocks.getSession).not.toHaveBeenCalled()
    })

    it('rejects invalid input before touching the database', async () => {
      const res = await app.request('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: 0,
          customerName: '',
          customerEmail: 'not-an-email',
          startsAt: 'not-a-date',
        }),
      })

      expect(res.status).toBe(400)
      expect(mocks.insert).not.toHaveBeenCalled()
    })

    it('rate-limits repeated public checkout attempts with a generic response', async () => {
      mocks.returning.mockImplementation(async () => [
        {
          id: '22222222-2222-4222-8222-222222222222',
          serviceId: validPayload.serviceId,
          customerName: validPayload.customerName,
          customerEmail: validPayload.customerEmail,
          startsAt: validPayload.startsAt,
          reference: mocks.values.mock.calls[0][0].reference,
        },
      ])
      const post = () =>
        app.request('/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validPayload),
        })

      for (let attempt = 0; attempt < 30; attempt += 1) {
        expect((await post()).status).toBe(201)
      }

      const res = await post()
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ error: 'too_many_requests' })
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(mocks.insert).toHaveBeenCalledTimes(30)
    })
  })

  describe('POST /bookings/:id/guest-link/resend — staff only', () => {
    const bookingId = '33333333-3333-4333-8333-333333333333'
    const reference = `bkg_${'c'.repeat(32)}`
    const credential = `gl_${'C'.repeat(43)}`
    const startsAt = new Date('2026-12-01T10:00:00.000Z')
    const expiresAt = guestLinkExpiresAt(startsAt)
    const linkBooking = {
      id: bookingId,
      customerEmail: validPayload.customerEmail,
      reference,
      startsAt,
      guestLinkVerifier: guestLinkVerifier(credential),
      guestLinkEncrypted: encryptGuestCredential(credential),
      guestLinkExpiresAt: expiresAt,
    }

    function postResend() {
      return app.request(`/bookings/${bookingId}/guest-link/resend`, { method: 'POST' })
    }

    it('refuses a request with no staff session', async () => {
      mocks.getSession.mockResolvedValue(null)

      const res = await postResend()

      expect(res.status).toBe(401)
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it('refuses a deactivated admin even if the session was not revoked', async () => {
      mocks.getSession.mockResolvedValue(bannedAdminSession)

      const res = await postResend()

      expect(res.status).toBe(403)
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it.each([
      ['operations', operationsSession],
      ['admin', adminSession],
    ])('lets %s resend the same unexpired link without extending expiry', async (_role, session) => {
      mocks.getSession.mockResolvedValue(session)
      mocks.limit.mockResolvedValueOnce([linkBooking])

      const res = await postResend()
      const body = await res.json()
      const emails = getCapturedMessages()

      expect(res.status).toBe(200)
      expect(body).toEqual({ id: bookingId, sent: true })
      expect(emails).toHaveLength(1)
      expect(emails[0].to).toBe(validPayload.customerEmail)
      expect(emails[0].text).toContain(credential)
      expect(emails[0].text).toContain(reference)
      expect(mocks.update).not.toHaveBeenCalled()
      expect(mocks.set).not.toHaveBeenCalled()
      expect(JSON.stringify(body)).not.toContain(credential)
    })

    it('refuses to resend an expired link and leaves its expiry unchanged', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.limit.mockResolvedValueOnce([
        { ...linkBooking, guestLinkExpiresAt: new Date('2020-01-01T00:00:00.000Z') },
      ])

      const res = await postResend()

      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'guest_link_expired' })
      expect(getCapturedMessages()).toHaveLength(0)
      expect(mocks.update).not.toHaveBeenCalled()
      expect(mocks.set).not.toHaveBeenCalled()
    })

    it('issues a first link for a backfilled row that has no credential', async () => {
      mocks.getSession.mockResolvedValue(adminSession)
      mocks.limit.mockResolvedValueOnce([
        {
          id: bookingId,
          customerEmail: validPayload.customerEmail,
          reference,
          startsAt,
          guestLinkVerifier: null,
          guestLinkEncrypted: null,
          guestLinkExpiresAt: null,
        },
      ])

      const res = await postResend()

      expect(res.status).toBe(200)
      const written = mocks.set.mock.calls[0][0]
      expect(written.guestLinkExpiresAt).toEqual(expiresAt)
      expect(written.guestLinkVerifier).toMatch(/^[0-9a-f]{64}$/)
      const newCredential = getCapturedMessages()[0].text.match(/token=(gl_[A-Za-z0-9_-]+)/)?.[1]
      expect(newCredential).toBeDefined()
      expect(verifyGuestLinkVerifier(written.guestLinkVerifier, newCredential!)).toBe(true)
    })
  })
})
