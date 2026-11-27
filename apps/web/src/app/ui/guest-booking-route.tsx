import { useParams, useSearch, type ErrorComponentProps } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { GuestBookingPage } from '@/pages/guest-booking'
import { ApiRequestError } from '@/shared/api'
import { RouteError } from './route-error'

/** Thin adapters: the page slice owns the UI, this file owns router wiring. */
export function GuestBookingRouteComponent() {
  const { reference } = useParams({ from: '/guest/bookings/$reference' })
  const { token } = useSearch({ from: '/guest/bookings/$reference' })
  return <GuestBookingPage reference={reference} token={token} />
}

export function GuestBookingRouteError({ error }: ErrorComponentProps) {
  const { t } = useTranslation('guestBooking')
  // Only the known denial code is surfaced. The thrown error could contain the
  // request URL with the private credential, so it is never rendered.
  const code = error instanceof ApiRequestError ? error.code : null
  const title = code === 'guest_link_invalid' ? t('invalidLink') : code === 'too_many_requests' ? t('tooManyRequests') : undefined
  return <RouteError title={title} />
}
