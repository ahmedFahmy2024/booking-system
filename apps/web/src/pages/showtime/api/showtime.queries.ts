import { queryOptions } from '@tanstack/react-query'
import { SHOWTIME_QUERY_ROOT } from '@/shared/api'
import { getSeatMap, getShowtime } from './showtime'

export const showtimeKeys = {
  all: [SHOWTIME_QUERY_ROOT] as const,
  detail: (id: string) => [SHOWTIME_QUERY_ROOT, id, 'detail'] as const,
  seatMap: (id: string) => [SHOWTIME_QUERY_ROOT, id, 'seat-map'] as const,
}

export const showtimeQuery = (id: string) =>
  queryOptions({
    queryKey: showtimeKeys.detail(id),
    queryFn: () => getShowtime(id),
  })

export const seatMapQuery = (id: string) =>
  queryOptions({
    queryKey: showtimeKeys.seatMap(id),
    queryFn: () => getSeatMap(id),
  })
