import { queryOptions } from '@tanstack/react-query'
import { listBookings, listServices } from './bookings'

export const bookingsKeys = {
  all: ['bookings'] as const,
  list: () => [...bookingsKeys.all, 'list'] as const,
  services: ['services'] as const,
}

export const bookingsQueries = {
  list: () =>
    queryOptions({
      queryKey: bookingsKeys.list(),
      queryFn: listBookings,
    }),
  services: () =>
    queryOptions({
      queryKey: bookingsKeys.services,
      queryFn: listServices,
    }),
}
