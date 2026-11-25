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
