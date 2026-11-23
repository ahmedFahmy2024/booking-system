import { createFileRoute } from '@tanstack/react-router'
import { seatMapQuery, showtimeQuery } from '@/pages/showtime'
import { ShowtimeRouteComponent, ShowtimeRouteError } from '../ui/showtime-route'
import { RoutePending } from '../ui/root-layout'

export const Route = createFileRoute('/showtimes/$showtimeId')({
  loader: ({ context: { queryClient }, params: { showtimeId } }) => {
    // The heading is awaited; the seat map is started independently so a slow
    // or failed map request cannot hide the heading (see B3.4 in build-plan.md).
    void queryClient.query({ ...seatMapQuery(showtimeId), staleTime: 'static' }).catch(() => {})
    return queryClient.query({ ...showtimeQuery(showtimeId), staleTime: 'static' })
  },
  pendingComponent: RoutePending,
  errorComponent: ShowtimeRouteError,
  component: ShowtimeRouteComponent,
})
