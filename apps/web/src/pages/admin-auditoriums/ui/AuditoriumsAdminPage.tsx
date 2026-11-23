import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AsyncSection, Skeleton } from '@/shared/ui'
import { AuditoriumAdmin } from './AuditoriumAdmin'

function AuditoriumsPending() {
  const { t } = useTranslation('common')

  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true" className="grid gap-6 min-[701px]:grid-cols-[minmax(300px,1.2fr)_minmax(260px,0.8fr)]">
        <Skeleton className="h-[30rem] w-full motion-reduce:animate-none" />
        <Skeleton className="h-40 w-full motion-reduce:animate-none" />
      </div>
    </div>
  )
}

export function AuditoriumsAdminPage() {
  const { t } = useTranslation('cinemaAdmin')

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">{t('auditoriumsTitle')}</h1>
          <p className="text-muted-foreground">{t('auditoriumsDescription')}</p>
        </div>
        <Link to="/admin/films" className="text-primary text-sm underline underline-offset-4">
          {t('filmsLink')}
        </Link>
      </div>
      <AsyncSection errorTitle={t('auditoriumsLoadError')} fallback={<AuditoriumsPending />}>
        <AuditoriumAdmin />
      </AsyncSection>
    </main>
  )
}
