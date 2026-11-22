import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { Bookings, bookingsQueries } from '@/features/bookings'
import { RootLayout } from './ui/root-layout'

export type RouterContext = { queryClient: QueryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

const bookingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    // Warm the shared QueryClient before the page mounts so navigating back
    // to this route does not flash a loading state when the cache is fresh.
    void context.queryClient.prefetchQuery(bookingsQueries.list())
    void context.queryClient.prefetchQuery(bookingsQueries.services())
  },
  component: Bookings,
})

const routeTree = rootRoute.addChildren([bookingsRoute])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
