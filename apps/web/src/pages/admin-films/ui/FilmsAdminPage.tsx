import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AsyncSection, Skeleton } from '@/shared/ui'
import { FilmAdmin } from './FilmAdmin'

function FilmsPending() {
  const { t } = useTranslation('common')

  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true" className="grid gap-6 min-[701px]:grid-cols-[minmax(280px,1fr)_minmax(280px,1.1fr)]">
        <Skeleton className="h-96 w-full motion-reduce:animate-none" />
        <Skeleton className="h-40 w-full motion-reduce:animate-none" />
      </div>
    </div>
  )
}

export function FilmsAdminPage() {
  const { t } = useTranslation('cinemaAdmin')

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">{t('filmsTitle')}</h1>
          <p className="text-muted-foreground">{t('filmsDescription')}</p>
        </div>
        <Link to="/admin/auditoriums" className="text-primary text-sm underline underline-offset-4">
          {t('auditoriumsLink')}
        </Link>
      </div>
      <AsyncSection errorTitle={t('filmsLoadError')} fallback={<FilmsPending />}>
        <FilmAdmin />
      </AsyncSection>
    </main>
  )
}
