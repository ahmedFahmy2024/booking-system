import { checkoutConflictSchema } from '@booking-system/cinema-contracts'
import { ApiRequestError } from '@/shared/api'

/** The machine-readable failure and the details a guest can act on. */
export interface ConfirmationFailure {
  code: string | null
  unitPricePiastres: number | null
  availableSeatIds: string[] | null
}

const noFailure: ConfirmationFailure = {
  code: null,
  unitPricePiastres: null,
  availableSeatIds: null,
}

/** Reads a conflict from the typed HTTP error; unrelated failures stay generic. */
export function readConfirmationFailure(error: unknown): ConfirmationFailure {
  if (!(error instanceof ApiRequestError)) return noFailure
  const parsed = checkoutConflictSchema.safeParse({ error: error.code, ...error.details })
  if (!parsed.success) {
    return { ...noFailure, code: error.code }
  }
  return {
    code: parsed.data.error,
    unitPricePiastres: parsed.data.unitPricePiastres,
    availableSeatIds: parsed.data.availableSeatIds,
  }
}

/** Known API codes get a specific message; anything else keeps the safe generic one. */
export type ConfirmationErrorKey =
  | 'confirmFailed'
  | 'seatsTaken'
  | 'bookingClosedError'
  | 'showtimeNotFound'
  | 'tooManyRequests'
  | 'idempotencyConflict'

const errorKeys: Record<string, ConfirmationErrorKey> = {
  seat_unavailable: 'seatsTaken',
  booking_closed: 'bookingClosedError',
  showtime_not_found: 'showtimeNotFound',
  too_many_requests: 'tooManyRequests',
  idempotency_key_conflict: 'idempotencyConflict',
}

export function confirmationErrorKey(code: string | null): ConfirmationErrorKey {
  return (code && errorKeys[code]) || 'confirmFailed'
}
