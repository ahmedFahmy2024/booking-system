import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmBooking } from '../api/showtime'
import { showtimeKeys } from '../api/showtime.queries'

export function useConfirmBooking(showtimeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: confirmBooking,
    // A successful claim changes availability and the accepted price; both
    // cached reads must be refreshed before the guest sees the map again.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: showtimeKeys.seatMap(showtimeId) })
      queryClient.invalidateQueries({ queryKey: showtimeKeys.detail(showtimeId) })
    },
  })
}
