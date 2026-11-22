import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'
import { createAppRouter } from '../router'
import { LocaleProvider } from './locale/locale-provider'
import { createQueryClient } from './query-client'

export function AppProviders() {
  // One QueryClient per app instance, shared with the router through context.
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(() => createAppRouter(queryClient))

  return (
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {import.meta.env.MODE === 'development' && (
          <TanStackDevtools
            plugins={[
              {
                id: 'react-query',
                name: 'React Query',
                render: () => <ReactQueryDevtoolsPanel />,
              },
              {
                id: 'router',
                name: 'Router',
                render: () => <TanStackRouterDevtoolsPanel router={router} />,
              },
            ]}
          />
        )}
      </QueryClientProvider>
    </LocaleProvider>
  )
}
