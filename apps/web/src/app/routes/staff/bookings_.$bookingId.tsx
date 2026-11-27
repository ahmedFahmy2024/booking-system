import { createFileRoute } from '@tanstack/react-router'
import { staffBookingDetailQuery, staffBookingsSearchSchema } from '@/pages/staff-bookings'
import {
  StaffBookingDetailRouteComponent,
  StaffBookingDetailRouteError,
} from '../../ui/staff-bookings-route'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/staff/bookings_/$bookingId')({
  // The detail URL carries the list filters so its back link restores the
  // identical filtered list after back, forward or reload.
  validateSearch: staffBookingsSearchSchema,
  loader: ({ context: { queryClient }, params }) =>
    queryClient.query({ ...staffBookingDetailQuery(params.bookingId), staleTime: 'static' }),
  pendingComponent: RoutePending,
  errorComponent: StaffBookingDetailRouteError,
  component: StaffBookingDetailRouteComponent,
})
