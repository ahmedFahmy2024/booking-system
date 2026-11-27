import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SHOWTIME_QUERY_ROOT } from '@/shared/api'
import { cancelGuestBooking } from '../api/guest-booking'
import { guestBookingKeys } from '../api/guest-booking.queries'

/**
 * The loader primes the detail with `staleTime: 'static'`, so a cancellation
 * must explicitly invalidate it or a reload would still show a confirmed
 * booking. The showtime root is invalidated too: those seats are available
 * again for anyone who returns to the seat map.
 */
export function useGuestCancellation(reference: string, token: string) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: guestBookingKeys.detail(reference, token) })
    queryClient.invalidateQueries({ queryKey: [SHOWTIME_QUERY_ROOT] })
  }

  return useMutation({
    mutationFn: () => cancelGuestBooking(reference, token),
    onSuccess: refresh,
    onError: refresh,
  })
}
