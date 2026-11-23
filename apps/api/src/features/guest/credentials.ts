import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const MIN_KEY_BYTES = 32
// Only used when NODE_ENV is not production. Production must supply GUEST_LINK_KEY.
const DEV_KEY = 'local-development-guest-link-key-not-for-production-use'

type DerivedKeys = { verifier: Buffer; encryption: Buffer }
let cachedKeys: DerivedKeys | undefined

/**
 * The private credential is both verified (HMAC) and encrypted for resend with
 * keys derived from one server-side secret. Never log or return the raw key.
 */
function rootKey(): Buffer {
  const configured = process.env.GUEST_LINK_KEY
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('GUEST_LINK_KEY is required in production')
    }
    return Buffer.from(DEV_KEY, 'utf8')
  }

  const encoded = configured.trim()
  const decoded = Buffer.from(encoded, 'base64')
  if (decoded.length < MIN_KEY_BYTES || decoded.toString('base64') !== encoded) {
    throw new Error('GUEST_LINK_KEY must be canonical base64 of at least 32 bytes')
  }
  return decoded
}

function keys(): DerivedKeys {
  if (!cachedKeys) {
    const root = rootKey()
    cachedKeys = {
      verifier: createHmac('sha256', root).update('booking-guest-link/verifier/v1').digest(),
      encryption: createHmac('sha256', root).update('booking-guest-link/encryption/v1').digest(),
    }
  }
  return cachedKeys
}

/** Test seam: re-read GUEST_LINK_KEY after changing the environment. */
export function resetGuestLinkKeyCache(): void {
  cachedKeys = undefined
}

/** Opaque support identifier. Not a credential: never accepted for guest access. */
export function createBookingReference(): string {
  return `bkg_${randomBytes(24).toString('base64url')}`
}

/** Unguessable bearer secret sent only in the guest email. */
export function createGuestCredential(): string {
  return `gl_${randomBytes(32).toString('base64url')}`
}

export function guestLinkVerifier(credential: string): string {
  return createHmac('sha256', keys().verifier).update(credential).digest('hex')
}

/** Constant-time comparison so a verifier mismatch cannot be timed. */
export function verifyGuestLinkVerifier(stored: string | null, credential: string): boolean {
  if (!stored) return false
  const expected = Buffer.from(guestLinkVerifier(credential), 'hex')
  const actual = Buffer.from(stored, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** AES-256-GCM: iv (12) || tag (16) || ciphertext, base64url encoded. */
export function encryptGuestCredential(credential: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keys().encryption, iv)
  const ciphertext = Buffer.concat([cipher.update(credential, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')
}

export function decryptGuestCredential(payload: string): string {
  const raw = Buffer.from(payload, 'base64url')
  if (raw.length < 29) throw new Error('Invalid guest link payload')
  const decipher = createDecipheriv('aes-256-gcm', keys().encryption, raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}

/** B2.4 uses bookings.startsAt as the showtime-start surrogate; B3 replaces it. */
export function guestLinkExpiresAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + SEVEN_DAYS_MS)
}

/** Valid through the exact expiry instant, denied one millisecond later. */
export function isGuestLinkExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true
  return now.getTime() > expiresAt.getTime()
}

export function matchesGuestCredential(
  verifier: string | null,
  expiresAt: Date | null,
  credential: string,
  now: Date = new Date(),
): boolean {
  return verifyGuestLinkVerifier(verifier, credential) && !isGuestLinkExpired(expiresAt, now)
}

export function guestLinkUrl(webUrl: string, reference: string, credential: string): string {
  return `${webUrl.replace(/\/$/, '')}/guest/bookings/${reference}?token=${credential}`
}
