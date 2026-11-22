import { Outlet } from '@tanstack/react-router'
import { Suspense } from 'react'

export function RootLayout() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Outlet />
    </Suspense>
  )
}
