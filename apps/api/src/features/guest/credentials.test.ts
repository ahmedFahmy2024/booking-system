import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createBookingReference,
  createGuestCredential,
  decryptGuestCredential,
  encryptGuestCredential,
  guestLinkExpiresAt,
  guestLinkUrl,
  guestLinkVerifier,
  isGuestLinkExpired,
  matchesGuestCredential,
  resetGuestLinkKeyCache,
  verifyGuestLinkVerifier,
} from './credentials.js'

const startsAt = new Date('2026-12-01T10:00:00.000Z')
const expiry = guestLinkExpiresAt(startsAt)

afterEach(() => {
  vi.unstubAllEnvs()
  resetGuestLinkKeyCache()
})

describe('guest link credentials', () => {
  it('creates distinct opaque references and unguessable credentials', () => {
    const first = createBookingReference()
    const second = createBookingReference()
    expect(first).toMatch(/^bkg_[A-Za-z0-9_-]{32}$/)
    expect(second).not.toBe(first)

    const credentialA = createGuestCredential()
    const credentialB = createGuestCredential()
    expect(credentialA).toMatch(/^gl_[A-Za-z0-9_-]{43}$/)
    expect(credentialB).not.toBe(credentialA)
  })

  it('derives a deterministic verifier and rejects wrong or absent ones', () => {
    const credential = createGuestCredential()
    const verifier = guestLinkVerifier(credential)
    expect(verifier).toMatch(/^[0-9a-f]{64}$/)
    expect(guestLinkVerifier(credential)).toBe(verifier)
    expect(verifyGuestLinkVerifier(verifier, credential)).toBe(true)
    expect(verifyGuestLinkVerifier(verifier, createGuestCredential())).toBe(false)
    expect(verifyGuestLinkVerifier(null, credential)).toBe(false)
  })

  it('encrypts the credential for resend and rejects tampering', () => {
    const credential = createGuestCredential()
    const ciphertext = encryptGuestCredential(credential)
    expect(ciphertext).not.toContain(credential)
    expect(decryptGuestCredential(ciphertext)).toBe(credential)

    const raw = Buffer.from(ciphertext, 'base64url')
    raw[raw.length - 1] ^= 1
    expect(() => decryptGuestCredential(raw.toString('base64url'))).toThrow()
  })

  it('expires exactly seven days after the showtime-start surrogate', () => {
    expect(expiry.toISOString()).toBe('2026-12-08T10:00:00.000Z')
    expect(isGuestLinkExpired(expiry, expiry)).toBe(false)
    expect(isGuestLinkExpired(expiry, new Date(expiry.getTime() + 1))).toBe(true)
    expect(isGuestLinkExpired(null, startsAt)).toBe(true)
  })

  it('matches only an unexpired verifier for the same credential', () => {
    const credential = createGuestCredential()
    const verifier = guestLinkVerifier(credential)
    expect(matchesGuestCredential(verifier, expiry, credential, expiry)).toBe(true)
    expect(matchesGuestCredential(verifier, expiry, credential, new Date(expiry.getTime() + 1000))).toBe(false)
    expect(matchesGuestCredential(null, expiry, credential, startsAt)).toBe(false)
  })

  it('builds a read-only link that carries the credential in the query', () => {
    const reference = createBookingReference()
    const credential = createGuestCredential()
    expect(guestLinkUrl('http://localhost:5173/', reference, credential)).toBe(
      `http://localhost:5173/guest/bookings/${reference}?token=${credential}`,
    )
  })

  it('requires an explicit 32-byte key in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GUEST_LINK_KEY', '')
    vi.resetModules()
    const fresh = await import('./credentials.js')
    expect(() => fresh.guestLinkVerifier('gl_test')).toThrow(/GUEST_LINK_KEY/)
  })
})
