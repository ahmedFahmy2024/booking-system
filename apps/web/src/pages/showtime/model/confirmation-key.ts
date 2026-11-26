import { idempotencyKeySchema } from '@booking-system/cinema-contracts'

/**
 * D4: one stable key belongs to one confirmation attempt. Keeping it outside
 * the component keeps render-only code free of ref access while the value
 * survives an unchanged retry (a lost response can then be replayed).
 */
export interface ConfirmationAttempt {
  fingerprint: string
  key: string
}

type AttemptRef = { current: ConfirmationAttempt | null }

const storageKey = (showtimeId: string) => `booking-checkout:${showtimeId}`

/** A lost response can also lose the page: keep the attempt in tab storage. */
export function loadConfirmationAttempt(showtimeId: string): ConfirmationAttempt | null {
  try {
    const raw = sessionStorage.getItem(storageKey(showtimeId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<ConfirmationAttempt>
    if (typeof candidate.fingerprint !== 'string') return null
    const key = idempotencyKeySchema.safeParse(candidate.key)
    if (!key.success) return null
    return { fingerprint: candidate.fingerprint, key: key.data }
  } catch {
    return null
  }
}

export function saveConfirmationAttempt(showtimeId: string, attempt: ConfirmationAttempt): void {
  try {
    sessionStorage.setItem(storageKey(showtimeId), JSON.stringify(attempt))
  } catch {
    // Storage can be disabled; the in-memory attempt still covers same-page retries.
  }
}

export function clearConfirmationAttempt(showtimeId: string): void {
  try {
    sessionStorage.removeItem(storageKey(showtimeId))
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** Rotate the key only when the canonical payload really changed. */
export function nextConfirmationKey(attempt: AttemptRef, fingerprint: string): string {
  if (!attempt.current || attempt.current.fingerprint !== fingerprint) {
    attempt.current = { fingerprint, key: crypto.randomUUID() }
  }
  return attempt.current.key
}

/** A confirmed outcome is final; any later submission is a new attempt. */
export function clearConfirmationKey(attempt: AttemptRef): void {
  attempt.current = null
}
