import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '@/shared/api'
import {
  guestBookingDetailSchema,
  guestBookingSearchSchema,
  guestCancellationErrorKey,
  guestTokenFingerprint,
  guestTokenFromSearch,
} from './guest-booking'

const reference = `bkg_${'a'.repeat(32)}`
const token = `gl_${'A'.repeat(43)}`

const cinema = {
  id: '33333333-3333-4333-8333-333333333333',
  reference,
  showtimeId: '11111111-1111-4111-8111-111111111111',
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T12:00:00.000Z',
  auditoriumName: 'Hall 1',
  seatLabels: ['A1'],
  unitPricePiastres: 2500,
  totalPiastres: 2500,
  customerEmail: 'guest@example.com',
  status: 'confirmed',
  canCancel: true,
}

const legacy = {
  id: '44444444-4444-4444-8444-444444444444',
  reference,
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  startsAt: '2026-12-01T12:00:00.000Z',
  serviceName: null,
  status: 'confirmed',
  canCancel: false,
}

describe('guest booking boundary schemas', () => {
  it('parses the cinema and legacy response shapes into distinct variants', () => {
    expect(guestBookingDetailSchema.parse(cinema)).toMatchObject({ kind: 'cinema', filmTitle: 'Cairo Nights' })
    expect(guestBookingDetailSchema.parse(legacy)).toMatchObject({ kind: 'legacy', customerName: 'Ahmed' })
  })

  it('strips unexpected keys and refuses a malformed success body', () => {
    const parsed = guestBookingDetailSchema.parse({ ...cinema, internal_only: 'must-not-render' })
    expect(parsed).not.toHaveProperty('internal_only')
    expect(() => guestBookingDetailSchema.parse({ ...cinema, filmTitle: undefined })).toThrow()
    expect(() => guestBookingDetailSchema.parse({ ...legacy, customerEmail: '' })).toThrow()
  })

  it('normalises missing, duplicated and non-string tokens before validation', () => {
    expect(guestTokenFromSearch({ token })).toBe(token)
    expect(guestTokenFromSearch({ token: [token, 'other'] })).toBe(token)
    expect(guestTokenFromSearch({ token: 42 })).toBe('')
    expect(guestTokenFromSearch(undefined)).toBe('')
    expect(guestBookingSearchSchema.parse({ token: guestTokenFromSearch({ token: 42 }) })).toEqual({ token: '' })
  })

  it('fingerprints a token without exposing it and keeps distinct tokens distinct', () => {
    const fingerprint = guestTokenFingerprint(token)
    expect(guestTokenFingerprint(token)).toBe(fingerprint)
    expect(guestTokenFingerprint(token)).not.toContain(token.slice(0, 8))
    expect(guestTokenFingerprint(`gl_${'B'.repeat(43)}`)).not.toBe(fingerprint)
  })

  it('maps only known cancellation codes to localized keys', () => {
    const error = (code: string | null) => new ApiRequestError('failed', 409, code, {})
    expect(guestCancellationErrorKey(error('cancellation_closed'))).toBe('cancellationClosed')
    expect(guestCancellationErrorKey(error('guest_link_invalid'))).toBe('invalidLink')
    expect(guestCancellationErrorKey(error('too_many_requests'))).toBe('tooManyRequests')
    expect(guestCancellationErrorKey(error('unknown'))).toBe('cancellationFailed')
    expect(guestCancellationErrorKey(new Error(`/guest/bookings/${token}`))).toBe('cancellationFailed')
  })
})
