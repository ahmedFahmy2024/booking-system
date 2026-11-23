import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertAction, AlertTitle } from './alert'
import { AnimatedSuspense } from './animated-suspense'
import { Button } from './button'

type AsyncSectionProps = {
  children: ReactNode
  fallback: ReactNode
  errorTitle: string
}

export function AsyncSection({ children, fallback, errorTitle }: AsyncSectionProps) {
  const { t } = useTranslation('common')

  return (
    <QueryErrorResetBoundary>
      {({ reset: resetQuery }) => (
        <CatchBoundary
          getResetKey={() => null}
          errorComponent={({ reset }) => (
            <Alert variant="destructive">
              <AlertTitle>{errorTitle}</AlertTitle>
              <AlertAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetQuery()
                    reset()
                  }}
                >
                  {t('retry')}
                </Button>
              </AlertAction>
            </Alert>
          )}
        >
          <AnimatedSuspense fallback={fallback}>{children}</AnimatedSuspense>
        </CatchBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
