import { createFileRoute } from '@tanstack/react-router'
import { adminFilmsQuery, FilmsAdminPage } from '@/pages/admin-films'
import { RouteError } from '../../ui/route-error'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/admin/films')({
  loader: ({ context: { queryClient } }) =>
    queryClient.query({ ...adminFilmsQuery(), staleTime: 'static' }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: FilmsAdminPage,
})
