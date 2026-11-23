import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AuditoriumAdmin } from './AuditoriumAdmin'

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
      <AuditoriumAdmin />
    </main>
  )
}
