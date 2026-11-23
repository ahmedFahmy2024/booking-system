import { useSuspenseQuery } from '@tanstack/react-query'
import { showtimeQuery } from '../api/showtime.queries'

export function useShowtime(id: string) {
  // The route loader primes this query, so the heading renders from cache.
  const { data: showtime } = useSuspenseQuery(showtimeQuery(id))
  return { showtime }
}
