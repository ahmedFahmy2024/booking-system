import { z } from 'zod'
import { ApiRequestError } from '@/shared/api'

/**
 * The private credential travels only in the link's query string. An absent
 * token is kept as an empty string so the API returns the same generic denial
 * as it does for an invalid one; the UI never renders or forwards it.
 */
export const guestBookingSearchSchema = z.object({
  token: z.string().default(''),
})

export type GuestBookingSearch = z.output<typeof guestBookingSearchSchema>

/**
 * Router match ids are derived from loader deps and are printed in dev-only
 * error logs. Keep the raw credential out of them while still giving each
 * token a distinct, non-reversible cache identity.
 */
export function guestTokenFingerprint(token: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < token.length; index += 1) {
    const char = token.charCodeAt(index)
    first = Math.imul(first ^ char, 0x01000193) >>> 0
    second = Math.imul(second ^ char, 0x85ebca6b) >>> 0
  }
  return `${first.toString(16)}-${second.toString(16)}`
}

/** Normalise malformed or duplicated query values before validation. */
export function guestTokenFromSearch(search: unknown): string {
  const value = (search as Record<string, unknown> | undefined)?.token
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

/**
 * A cinema booking shows the outcome frozen at confirmation (D3), not live
 * catalogue rows. Prototype rows predate that snapshot and keep their old
 * response shape, so the two variants are parsed explicitly at the boundary.
 */
const cinemaBookingSchema = z
  .object({
    id: z.uuid(),
    reference: z.string().min(1),
    showtimeId: z.uuid(),
    filmTitle: z.string(),
    startsAt: z.iso.datetime(),
    auditoriumName: z.string(),
    seatLabels: z.array(z.string()),
    unitPricePiastres: z.number().int().positive(),
    totalPiastres: z.number().int().positive(),
    customerEmail: z.email(),
    status: z.enum(['confirmed', 'cancelled']),
    canCancel: z.boolean(),
  })
  .transform((detail) => ({ kind: 'cinema' as const, ...detail }))

const legacyBookingSchema = z
  .object({
    id: z.uuid(),
    reference: z.string().min(1),
    customerName: z.string(),
    customerEmail: z.email(),
    startsAt: z.iso.datetime(),
    serviceName: z.string().nullable(),
    status: z.enum(['confirmed', 'cancelled']),
    canCancel: z.boolean(),
  })
  .transform((detail) => ({ kind: 'legacy' as const, ...detail }))

export const guestBookingDetailSchema = z.union([cinemaBookingSchema, legacyBookingSchema])

export type GuestBookingDetail = z.output<typeof guestBookingDetailSchema>

export type GuestCancellationErrorKey =
  | 'cancellationClosed'
  | 'invalidLink'
  | 'tooManyRequests'
  | 'cancellationFailed'

/**
 * Only the API's machine-readable code reaches the UI. The raw error may carry
 * the private link URL, so neither its message nor the thrown error is shown.
 */
export function guestCancellationErrorKey(error: unknown): GuestCancellationErrorKey {
  if (!(error instanceof ApiRequestError)) return 'cancellationFailed'
  switch (error.code) {
    case 'cancellation_closed':
      return 'cancellationClosed'
    case 'guest_link_invalid':
      return 'invalidLink'
    case 'too_many_requests':
      return 'tooManyRequests'
    default:
      return 'cancellationFailed'
  }
}
