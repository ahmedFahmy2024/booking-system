import { createFileRoute } from '@tanstack/react-router'
import { staffBookingsQuery, staffBookingsSearchSchema, staffFiltersQuery } from '@/pages/staff-bookings'
import {
  StaffBookingsRouteComponent,
  StaffBookingsRouteError,
} from '../../ui/staff-bookings-route'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/staff/bookings')({
  validateSearch: staffBookingsSearchSchema,
  // All filters and pagination belong to the loader deps and the Query key, so
  // search-param changes refetch the matching page and back/forward restores it.
  loaderDeps: ({ search }) => ({
    reference: search.reference,
    filmId: search.filmId,
    showtimeId: search.showtimeId,
    status: search.status,
    period: search.period,
    page: search.page,
    pageSize: search.pageSize,
  }),
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.query({ ...staffBookingsQuery(deps), staleTime: 'static' }),
      queryClient.query({ ...staffFiltersQuery(), staleTime: 'static' }),
    ]),
  pendingComponent: RoutePending,
  errorComponent: StaffBookingsRouteError,
  component: StaffBookingsRouteComponent,
})
