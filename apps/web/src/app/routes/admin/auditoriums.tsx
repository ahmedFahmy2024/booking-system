import { createFileRoute } from '@tanstack/react-router'
import { AuditoriumsAdminPage, adminAuditoriumsQuery } from '@/pages/admin-auditoriums'
import { RouteError } from '../../ui/route-error'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/admin/auditoriums')({
  loader: ({ context: { queryClient } }) => {
    // The panel owns pending and error states for this request.
    void queryClient.query({ ...adminAuditoriumsQuery(), staleTime: 'static' }).catch(() => {})
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: AuditoriumsAdminPage,
})
