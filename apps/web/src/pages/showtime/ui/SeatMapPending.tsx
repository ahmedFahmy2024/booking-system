import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/shared/ui'

export function SeatMapPending() {
  const { t } = useTranslation('common')

  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-24 w-full motion-reduce:animate-none" />
        <Skeleton className="h-24 w-full motion-reduce:animate-none" />
      </div>
    </div>
  )
}
