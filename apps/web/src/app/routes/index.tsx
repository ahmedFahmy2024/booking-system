import { createFileRoute } from '@tanstack/react-router'
import { Bookings, bookingsQueries } from '@/features/bookings'
import { RouteError } from '../ui/route-error'

export const Route = createFileRoute('/')({
  // `queryClient.query` replaced the deprecated ensureQueryData/prefetchQuery.
  // `staleTime: 'static'` keeps the old ensureQueryData behaviour: use cached
  // data as-is and only fetch when the cache is empty.
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.query({ ...bookingsQueries.list(), staleTime: 'static' }),
      queryClient.query({ ...bookingsQueries.services(), staleTime: 'static' }),
    ]),
  pendingComponent: () => <p>Loading…</p>,
  errorComponent: RouteError,
  component: Bookings,
})
