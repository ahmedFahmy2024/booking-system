import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBooking } from '../api/bookings'
import { bookingsKeys } from '../api/bookings.queries'

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.list() })
    },
  })
}
