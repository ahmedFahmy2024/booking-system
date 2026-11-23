import { createFileRoute } from '@tanstack/react-router'
import { AuditoriumsAdminPage, adminAuditoriumsQuery } from '@/pages/admin-auditoriums'
import { RouteError } from '../../ui/route-error'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/admin/auditoriums')({
  loader: ({ context: { queryClient } }) =>
    queryClient.query({ ...adminAuditoriumsQuery(), staleTime: 'static' }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: AuditoriumsAdminPage,
})
