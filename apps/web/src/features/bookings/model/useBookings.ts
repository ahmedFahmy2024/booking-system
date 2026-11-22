import { useCallback, useEffect, useState } from 'react'
import {
  createBooking as apiCreateBooking,
  listBookings,
  listServices,
} from '../api/bookings'
import type { Booking, BookingInput, Service } from './booking'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextBookings, nextServices] = await Promise.all([
        listBookings(),
        listServices(),
      ])
      setBookings(nextBookings)
      setServices(nextServices)
      setError(null)
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetching is synchronization with the API (an external system); the
    // initial render cannot know the server state.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const addBooking = useCallback(
    async (input: BookingInput) => {
      await apiCreateBooking(input)
      await refresh()
    },
    [refresh],
  )

  return { bookings, services, isLoading, error, addBooking }
}
