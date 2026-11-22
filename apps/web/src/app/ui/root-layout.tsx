import { Outlet } from '@tanstack/react-router'
import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/shared/ui/skeleton'

export function RoutePending() {
  const { t } = useTranslation('common')
  return <p role="status">{t('loading')}</p>
}

export function RootLayout() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
          <div className="grid gap-8 min-[701px]:grid-cols-[minmax(260px,1fr)_minmax(280px,1.2fr)]">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        </div>
      }
    >
      <Outlet />
    </Suspense>
  )
}
