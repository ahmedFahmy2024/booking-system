import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SHOWTIME_QUERY_ROOT } from '@/shared/api'

const mocks = vi.hoisted(() => ({ cancelGuestBooking: vi.fn() }))

vi.mock('../api/guest-booking', () => ({ cancelGuestBooking: mocks.cancelGuestBooking }))

import { guestBookingKeys } from '../api/guest-booking.queries'
import { useGuestCancellation } from './useGuestCancellation'

const reference = `bkg_${'a'.repeat(32)}`
const token = `gl_${'A'.repeat(43)}`

describe('useGuestCancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cancelGuestBooking.mockResolvedValue({ status: 'cancelled' })
  })

  it('refreshes the pinned guest detail and the seat map after a cancellation', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useGuestCancellation(reference, token), { wrapper })

    await result.current.mutateAsync()

    await waitFor(() => {
      expect(mocks.cancelGuestBooking).toHaveBeenCalledWith(reference, token)
      expect(invalidate).toHaveBeenCalledWith({ queryKey: guestBookingKeys.detail(reference, token) })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [SHOWTIME_QUERY_ROOT] })
    })
  })
})
