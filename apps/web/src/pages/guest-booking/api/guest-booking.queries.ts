import { queryOptions } from '@tanstack/react-query'
import { getGuestBooking } from './guest-booking'

export const guestBookingKeys = {
  /**
   * The token is part of the key so an invalid link for a reference can never
   * reuse a successful read made with a valid one. Devtools are stripped from
   * production builds; the credential is still never rendered or logged.
   */
  detail: (reference: string, token: string) => ['guest-booking', reference, token] as const,
}

export const guestBookingQuery = (reference: string, token: string) =>
  queryOptions({
    queryKey: guestBookingKeys.detail(reference, token),
    queryFn: () => getGuestBooking(reference, token),
  })
