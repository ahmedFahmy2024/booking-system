import { useParams, type ErrorComponentProps } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ShowtimePage } from '@/pages/showtime'
import { RouteError } from './route-error'

/** Thin adapters: the page slice owns the UI, this file owns router wiring. */
export function ShowtimeRouteComponent() {
  const { showtimeId } = useParams({ from: '/showtimes/$showtimeId' })
  return <ShowtimePage showtimeId={showtimeId} />
}

export function ShowtimeRouteError({ error }: ErrorComponentProps) {
  const { t } = useTranslation('catalogue')
  return (
    <RouteError
      title={
        error instanceof Error && error.message === 'showtime_not_found'
          ? t('showtimeNotFound')
          : undefined
      }
    />
  )
}
