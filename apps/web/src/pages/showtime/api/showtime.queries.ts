import { queryOptions } from '@tanstack/react-query'
import { getSeatMap, getShowtime } from './showtime'

export const showtimeKeys = {
  all: ['showtime'] as const,
  detail: (id: string) => ['showtime', id, 'detail'] as const,
  seatMap: (id: string) => ['showtime', id, 'seat-map'] as const,
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
