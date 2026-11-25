import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { confirmBooking } from '../api/showtime'
import { showtimeKeys } from '../api/showtime.queries'
import { checkoutPayloadFingerprint, type CheckoutRequest } from './checkout'
import {
  clearConfirmationKey,
  nextConfirmationKey,
  type ConfirmationAttempt,
} from './confirmation-key'

export function useConfirmBooking(showtimeId: string) {
  const queryClient = useQueryClient()
  // The retry contract belongs to the write: an unchanged retry reuses the key
  // so a lost response replays, while a changed payload starts a new attempt.
  const attemptRef = useRef<ConfirmationAttempt | null>(null)

  const invalidateReads = () => {
    // Both a claim and a conflict can change what the guest sees: a successful
    // claim changes availability, and a denial may follow another guest's claim
    // or an admin's price change. Refresh both reads so the guest can revise.
    queryClient.invalidateQueries({ queryKey: showtimeKeys.seatMap(showtimeId) })
    queryClient.invalidateQueries({ queryKey: showtimeKeys.detail(showtimeId) })
  }

  return useMutation({
    mutationFn: (checkout: CheckoutRequest) =>
      confirmBooking({
        checkout,
        idempotencyKey: nextConfirmationKey(attemptRef, checkoutPayloadFingerprint(checkout)),
      }),
    onSuccess: () => {
      // The booked outcome is final; a later submission is a new attempt.
      clearConfirmationKey(attemptRef)
      invalidateReads()
    },
    onError: invalidateReads,
  })
}
