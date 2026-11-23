import { createFileRoute } from '@tanstack/react-router'
import { cinemaAdminQueries, FilmsAdminPage } from '@/pages/cinema-admin'
import { RouteError } from '../../ui/route-error'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/admin/films')({
  loader: ({ context: { queryClient } }) =>
    queryClient.query({ ...cinemaAdminQueries.films(), staleTime: 'static' }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: FilmsAdminPage,
})
