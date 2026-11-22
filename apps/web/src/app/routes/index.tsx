import { createFileRoute } from '@tanstack/react-router'
import { Bookings, bookingsQueries } from '@/features/bookings'

export const Route = createFileRoute('/')({
  // Fill the shared QueryClient before rendering so the component can read
  // the same query options from the cache without a second loading state.
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(bookingsQueries.list()),
      queryClient.ensureQueryData(bookingsQueries.services()),
    ]),
  pendingComponent: () => <p>Loading…</p>,
  errorComponent: ({ error }) => (
    <p role="alert">{error instanceof Error ? error.message : 'Something went wrong'}</p>
  ),
  component: Bookings,
})
