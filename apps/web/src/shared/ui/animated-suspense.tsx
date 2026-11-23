import { Suspense, ViewTransition, type ReactNode } from 'react'
import './animated-suspense.css'

export function AnimatedSuspense({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition default="none" exit="suspense-fallback">
          {fallback}
        </ViewTransition>
      }
    >
      <ViewTransition default="none" enter="suspense-content">
        {children}
      </ViewTransition>
    </Suspense>
  )
}
