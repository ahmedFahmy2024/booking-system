import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBooking } from '../api/bookings'
import { bookingsKeys } from '../api/bookings.queries'

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBooking,
    // Returning the promise makes mutateAsync wait for the refetched list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingsKeys.list() }),
  })
}
