import { useQuery } from '@tanstack/react-query'
import { bookingsQueries } from '../api/bookings.queries'
import type { BookingInput } from './booking'
import { useCreateBooking } from './useCreateBooking'

export function useBookings() {
  const bookingsQuery = useQuery(bookingsQueries.list())
  const servicesQuery = useQuery(bookingsQueries.services())
  const createBooking = useCreateBooking()

  return {
    bookings: bookingsQuery.data ?? [],
    services: servicesQuery.data ?? [],
    isLoading: bookingsQuery.isLoading || servicesQuery.isLoading,
    error: bookingsQuery.error?.message ?? servicesQuery.error?.message ?? null,
    addBooking: async (input: BookingInput) => {
      await createBooking.mutateAsync(input)
    },
  }
}
