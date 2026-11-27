import { useSuspenseQuery } from '@tanstack/react-query'
import { guestBookingQuery } from '../api/guest-booking.queries'

/** The route loader primes this query, so the details render from cache. */
export function useGuestBooking(reference: string, token: string) {
  const { data: booking } = useSuspenseQuery(guestBookingQuery(reference, token))
  return { booking }
}
