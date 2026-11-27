import { createFileRoute } from '@tanstack/react-router'
import { guestBookingQuery, guestBookingSearchSchema, guestTokenFingerprint, guestTokenFromSearch } from '@/pages/guest-booking'
import { GuestBookingRouteComponent, GuestBookingRouteError } from '../../ui/guest-booking-route'
import { RoutePending } from '../../ui/root-layout'

export const Route = createFileRoute('/guest/bookings/$reference')({
  validateSearch: (search: Record<string, unknown>) =>
    guestBookingSearchSchema.parse({ token: guestTokenFromSearch(search) }),
  // The router prints loader deps in dev-only route-match warnings, so the
  // credential is represented by a fingerprint instead of its raw value.
  loaderDeps: ({ search }) => ({ token: guestTokenFingerprint(search.token) }),
  loader: ({ context: { queryClient }, params: { reference }, location }) => {
    const token = guestTokenFromSearch(location.search)
    return queryClient.query({ ...guestBookingQuery(reference, token), staleTime: 'static' })
  },
  // Belt and braces for any request initiated from this document. The fetch
  // itself also sets referrerPolicy, which covers the loader's first request.
  head: () => ({ meta: [{ name: 'referrer', content: 'no-referrer' }] }),
  pendingComponent: RoutePending,
  errorComponent: GuestBookingRouteError,
  component: GuestBookingRouteComponent,
})
