import { createFileRoute } from '@tanstack/react-router'
import { AuditoriumsAdminPage, cinemaAdminQueries } from '@/pages/cinema-admin'
import { RouteError } from '../../ui/route-error'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/admin/auditoriums')({
  loader: ({ context: { queryClient } }) =>
    queryClient.query({ ...cinemaAdminQueries.auditoriums(), staleTime: 'static' }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: AuditoriumsAdminPage,
})
