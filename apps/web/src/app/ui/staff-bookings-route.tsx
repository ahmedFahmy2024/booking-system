import { useParams, useSearch, type ErrorComponentProps } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  staffBookingErrorKey,
  StaffBookingsPage,
  StaffBookingDetailPage,
} from '@/pages/staff-bookings'
import { RouteError } from './route-error'

/** Thin adapters: the page slice owns the UI, this file owns router wiring. */
export function StaffBookingsRouteComponent() {
  const search = useSearch({ from: '/staff/bookings' })
  return <StaffBookingsPage search={search} />
}

export function StaffBookingsRouteError({ error }: ErrorComponentProps) {
  const { t } = useTranslation('staffBookings')
  return <RouteError title={t(staffBookingErrorKey(error, 'loadError'))} />
}

export function StaffBookingDetailRouteComponent() {
  // The underscore in the file name keeps this route out of the list route's
  // layout, so its generated id differs from its URL path.
  const { bookingId } = useParams({ from: '/staff/bookings_/$bookingId' })
  const search = useSearch({ from: '/staff/bookings_/$bookingId' })
  return <StaffBookingDetailPage bookingId={bookingId} backSearch={search} />
}

export function StaffBookingDetailRouteError({ error }: ErrorComponentProps) {
  const { t } = useTranslation('staffBookings')
  return <RouteError title={t(staffBookingErrorKey(error, 'detailLoadError'))} />
}
