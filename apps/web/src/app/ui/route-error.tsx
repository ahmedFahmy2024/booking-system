import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  // Clear the Query error boundary so a retried loader can fetch again.
  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  return (
    <div role="alert">
      <p>{error instanceof Error ? error.message : String(error)}</p>
      <button onClick={() => router.invalidate()}>Retry</button>
    </div>
  )
}
