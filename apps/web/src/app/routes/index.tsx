import { createFileRoute } from '@tanstack/react-router'
import { CataloguePage, catalogueQuery } from '@/pages/catalogue'
import { RouteError } from '../ui/route-error'
import { RoutePending } from '../ui/root-layout'

export const Route = createFileRoute('/')({
  // `staleTime: 'static'` keeps cached data on a warm navigation and only
  // fetches when the cache is empty (see docs/ARCHITECTURE.md).
  loader: ({ context: { queryClient } }) =>
    queryClient.query({ ...catalogueQuery(), staleTime: 'static' }),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: CataloguePage,
})
