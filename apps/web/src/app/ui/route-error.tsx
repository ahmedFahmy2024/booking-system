import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertAction, AlertTitle, Button } from '@/shared/ui'

export function RouteError({ title }: { title?: string } = {}) {
  const { t } = useTranslation('common')
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  // Clear the Query error boundary so a retried loader can fetch again.
  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  return (
    <Alert variant="destructive">
      <AlertTitle>{title ?? t('pageLoadError')}</AlertTitle>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={() => router.invalidate()}>
          {t('retry')}
        </Button>
      </AlertAction>
    </Alert>
  )
}
