import { useSuspenseQuery } from '@tanstack/react-query'
import { bookingsQueries } from '../api/bookings.queries'
import type { BookingInput } from './booking'
import { useCreateBooking } from './useCreateBooking'

export function useBookings() {
  // The route loader already called ensureQueryData for both options, so
  // these reads are synchronous from the cache on the first render.
  const bookingsQuery = useSuspenseQuery(bookingsQueries.list())
  const servicesQuery = useSuspenseQuery(bookingsQueries.services())
  const createBooking = useCreateBooking()

  return {
    bookings: bookingsQuery.data,
    services: servicesQuery.data,
    addBooking: async (input: BookingInput) => {
      await createBooking.mutateAsync(input)
    },
  }
}
