import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The route calls getDb() at request time and requireStaff calls
// auth.api.getSession(). Mock both boundaries so tests need no DATABASE_URL and
// never reach Neon. vi.hoisted runs before vi.mock is hoisted.
const mocks = vi.hoisted(() => {
  const leftJoin = vi.fn()
  const from = vi.fn()
  const returning = vi.fn()
  const values = vi.fn()
  const getSession = vi.fn()
  const where = vi.fn()
  const limit = vi.fn()
  const update = vi.fn()
  const set = vi.fn()
  const remove = vi.fn()
  const deleteWhere = vi.fn()
  const batch = vi.fn()

  return {
    select: vi.fn(),
    insert: vi.fn(),
    leftJoin,
    from,
    values,
    returning,
    getSession,
    where,
    limit,
    update,
    set,
    remove,
    deleteWhere,
    batch,
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
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.remove,
    batch: mocks.batch,
  }),
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
  mocks.from.mockReturnValue({ leftJoin: mocks.leftJoin, where: mocks.where })
  mocks.values.mockReturnValue({ returning: mocks.returning })
  mocks.leftJoin.mockResolvedValue([])
  mocks.where.mockReturnValue({ limit: mocks.limit, returning: mocks.returning })
  mocks.limit.mockResolvedValue([])
  mocks.update.mockReturnValue({ set: mocks.set })
  mocks.set.mockReturnValue({ where: mocks.where })
  mocks.remove.mockReturnValue({ where: mocks.deleteWhere })
  mocks.deleteWhere.mockReturnValue({})
  mocks.batch.mockResolvedValue([[{ id: storedBooking.id }], []])
})

afterEach(() => {
  vi.useRealTimers()
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
      mocks.leftJoin.mockResolvedValueOnce([storedBooking])

      const res = await listBookings()

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([listedBooking])
    })

    it('allows an admin and keeps the existing response contract', async () => {
      mocks.getSession.mockResolvedValue(adminSession)
      mocks.leftJoin.mockResolvedValueOnce([storedBooking])

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

  describe('POST /bookings/:id/cancel — staff cancellation (B5.3)', () => {
    const cancelId = '44444444-4444-4444-8444-444444444444'
    const cancelReference = `bkg_${'d'.repeat(32)}`
    const now = new Date('2026-11-28T10:00:00.000Z')
    const futureStart = new Date('2026-12-05T10:00:00.000Z')
    const reason = 'Guest called the cinema and asked to cancel'
    const cinemaRow = {
      id: cancelId,
      reference: cancelReference,
      status: 'confirmed',
      startsAt: futureStart,
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: null,
      idempotencyResponse: {
        id: cancelId,
        reference: cancelReference,
        showtimeId: '55555555-5555-4555-8555-555555555555',
        filmTitle: 'Cairo Nights',
        startsAt: futureStart.toISOString(),
        auditoriumName: 'Hall 1',
        seatLabels: ['A1'],
        seatIds: ['aaaa0000-0000-4000-8000-000000000001'],
        unitPricePiastres: 2500,
        totalPiastres: 2500,
      },
    }

    function postCancel(
      id: string = cancelId,
      body: unknown = { reason },
    ) {
      return app.request(`/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(now)
    })

    it('refuses anonymous, deactivated and unknown-role sessions before any read', async () => {
      mocks.getSession.mockResolvedValueOnce(null)
      expect((await postCancel()).status).toBe(401)
      mocks.getSession.mockResolvedValueOnce(bannedOperationsSession)
      expect((await postCancel()).status).toBe(403)
      mocks.getSession.mockResolvedValueOnce(wrongRoleSession)
      expect((await postCancel()).status).toBe(403)

      expect(mocks.select).not.toHaveBeenCalled()
      expect(mocks.batch).not.toHaveBeenCalled()
    })

    it.each([
      ['operations', operationsSession, 'ops-1'],
      ['admin', adminSession, 'admin-1'],
    ])('lets %s cancel with a reason and records the actor in one transaction', async (_role, session, actorId) => {
      mocks.getSession.mockResolvedValue(session)
      mocks.limit.mockResolvedValueOnce([cinemaRow])
      mocks.batch.mockResolvedValueOnce([[{ id: cancelId }], []])

      const res = await postCancel()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({
        id: cancelId,
        reference: cancelReference,
        status: 'cancelled',
        cancelledAt: now.toISOString(),
        cancelledByUserId: actorId,
        cancellationReason: reason,
      })
      expect(mocks.batch).toHaveBeenCalledTimes(1)
      const written = mocks.set.mock.calls[0][0]
      expect(written).toEqual({
        status: 'cancelled',
        cancelledAt: now,
        cancelledByUserId: actorId,
        cancellationReason: reason,
      })
      expect(mocks.deleteWhere).toHaveBeenCalledTimes(1)
      expect(getCapturedMessages()).toHaveLength(0)
    })

    it('uses the stored start instant for a legacy row without a frozen snapshot', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.limit.mockResolvedValueOnce([{ ...cinemaRow, idempotencyResponse: null }])

      const res = await postCancel()

      expect(res.status).toBe(200)
      expect(mocks.batch).toHaveBeenCalledTimes(1)
    })

    it('refuses at the exact showtime start and one millisecond after it', async () => {
      vi.setSystemTime(futureStart)
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.limit.mockResolvedValueOnce([cinemaRow])

      const atBoundary = await postCancel()
      expect(atBoundary.status).toBe(409)
      expect(await atBoundary.json()).toEqual({ error: 'showtime_started' })

      vi.setSystemTime(new Date(futureStart.getTime() + 1))
      mocks.limit.mockResolvedValueOnce([cinemaRow])
      const afterBoundary = await postCancel()
      expect(afterBoundary.status).toBe(409)
      expect(mocks.batch).not.toHaveBeenCalled()
      expect(mocks.set).not.toHaveBeenCalled()
    })

    it('allows a cancellation one millisecond before the showtime starts', async () => {
      vi.setSystemTime(new Date(futureStart.getTime() - 1))
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.limit.mockResolvedValueOnce([cinemaRow])
      mocks.batch.mockResolvedValueOnce([[{ id: cancelId }], []])

      expect((await postCancel()).status).toBe(200)
      expect(mocks.batch).toHaveBeenCalledTimes(1)
      expect(mocks.batch.mock.calls[0][0]).toHaveLength(2)
    })

    it('re-checks the cutoff at write time if the clock passes the start during the read', async () => {
      vi.setSystemTime(new Date(futureStart.getTime() - 1))
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.limit.mockImplementationOnce(async () => {
        vi.setSystemTime(futureStart)
        return [cinemaRow]
      })

      const res = await postCancel()

      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'showtime_started' })
      expect(mocks.batch).not.toHaveBeenCalled()
    })

    it('reports an already cancelled booking without a second write, even with a different reason', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)
      const cancelled = {
        ...cinemaRow,
        status: 'cancelled',
        cancelledAt: new Date('2026-11-27T09:00:00.000Z'),
        cancelledByUserId: 'ops-9',
        cancellationReason: 'Original reason',
      }
      mocks.limit.mockResolvedValue([cancelled])

      const first = await postCancel(cancelId, { reason: 'A different reason' })
      const second = await postCancel(cancelId, { reason: 'A different reason' })
      const firstBody = await first.json()

      expect(first.status).toBe(200)
      expect(await second.json()).toEqual(firstBody)
      expect(firstBody.cancellationReason).toBe('Original reason')
      expect(firstBody.cancelledByUserId).toBe('ops-9')
      expect(mocks.batch).not.toHaveBeenCalled()
    })

    it('does not overwrite the winner of a competing cancellation', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.limit.mockResolvedValueOnce([cinemaRow])
      // The guest won the race: this staff compare-and-swap updated no row.
      mocks.batch.mockResolvedValueOnce([[], []])
      mocks.limit.mockResolvedValueOnce([
        {
          ...cinemaRow,
          status: 'cancelled',
          cancelledAt: new Date('2026-11-27T09:00:00.000Z'),
          cancelledByUserId: null,
          cancellationReason: null,
        },
      ])

      const res = await postCancel()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.cancelledByUserId).toBeNull()
      expect(body.cancellationReason).toBeNull()
      expect(mocks.batch).toHaveBeenCalledTimes(1)
      expect(mocks.deleteWhere).toHaveBeenCalledTimes(1)
    })

    it('rejects blank, oversized and missing reasons before reading the booking', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)

      for (const body of [
        { reason: '' },
        { reason: '   ' },
        { reason: 'x'.repeat(501) },
        {},
      ]) {
        const res = await postCancel(cancelId, body)
        expect(res.status).toBe(400)
      }
      expect(mocks.select).not.toHaveBeenCalled()
      expect(mocks.batch).not.toHaveBeenCalled()
    })

    it('rejects a non-UUID booking id before touching the database', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)

      const res = await postCancel('not-a-uuid')

      expect(res.status).toBe(400)
      expect(mocks.select).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown booking and accepts a corrected retry for a bad reason', async () => {
      mocks.getSession.mockResolvedValue(operationsSession)
      mocks.limit.mockResolvedValueOnce([])
      expect((await postCancel()).status).toBe(404)

      mocks.limit.mockResolvedValueOnce([cinemaRow])
      mocks.batch.mockResolvedValueOnce([[{ id: cancelId }], []])
      const retry = await postCancel(cancelId, { reason: '   ' + reason + '  ' })
      expect(retry.status).toBe(200)
      expect((await retry.json()).cancellationReason).toBe(reason)
    })
  })
})
