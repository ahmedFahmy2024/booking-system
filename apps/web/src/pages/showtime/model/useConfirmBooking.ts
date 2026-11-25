import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmBooking } from '../api/showtime'
import { showtimeKeys } from '../api/showtime.queries'

export function useConfirmBooking(showtimeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: confirmBooking,
    // Both a claim and a conflict can change what the guest sees: a successful
    // claim changes availability, and a denial may follow another guest's claim
    // or an admin's price change. Refresh both reads so the guest can revise.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: showtimeKeys.seatMap(showtimeId) })
      queryClient.invalidateQueries({ queryKey: showtimeKeys.detail(showtimeId) })
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: showtimeKeys.seatMap(showtimeId) })
      queryClient.invalidateQueries({ queryKey: showtimeKeys.detail(showtimeId) })
    },
  })
}
