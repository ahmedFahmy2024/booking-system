import { useSuspenseQuery } from '@tanstack/react-query'
import { seatMapQuery } from '../api/showtime.queries'

export function useSeatMap(id: string) {
  // The loader starts this request without awaiting it; AsyncSection owns its
  // pending and error states so the showtime heading stays visible.
  const { data: seatMap } = useSuspenseQuery(seatMapQuery(id))
  return { seatMap }
}
