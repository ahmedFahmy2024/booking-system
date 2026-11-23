import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formatCairoDateTime, formatEgp } from '@/shared/lib'
import { AsyncSection } from '@/shared/ui'
import { useShowtime } from '../model/useShowtime'
import { SeatMapPending } from './SeatMapPending'
import { SeatMapSection } from './SeatMapSection'

export function ShowtimePage({ showtimeId }: { showtimeId: string }) {
  const { t, i18n } = useTranslation('catalogue')
  const { showtime } = useShowtime(showtimeId)
  const locale = i18n.resolvedLanguage ?? i18n.language

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8">
      <Link to="/" className="text-primary text-sm underline underline-offset-4">
        {t('backToFilms')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 dir="auto" className="text-2xl font-semibold">
            {showtime.filmTitle}
          </h1>
          <p dir="auto" className="text-muted-foreground text-sm">
            {showtime.synopsis}
          </p>
          <p className="text-muted-foreground text-sm">
            {t('duration', { count: showtime.durationMinutes })}
            {' · '}
            <bdi>{t('auditorium', { name: showtime.auditoriumName })}</bdi>
          </p>
          <time dateTime={showtime.startsAt} className="font-medium">
            {t('showtimeCairo', { date: formatCairoDateTime(showtime.startsAt, locale) })}
          </time>
          <p className="text-sm">{t('pricePerSeat', { price: formatEgp(showtime.pricePiastres, locale) })}</p>
          {showtime.bookingClosed && (
            <p role="status" className="text-sm font-medium">
              {t('bookingClosed')}
            </p>
          )}
        </div>
        {showtime.posterUrl && (
          <img
            src={showtime.posterUrl}
            alt=""
            loading="lazy"
            className="max-h-56 w-40 rounded-lg object-cover"
          />
        )}
      </header>
      <AsyncSection errorTitle={t('seatMapLoadError')} fallback={<SeatMapPending />}>
        <SeatMapSection showtimeId={showtimeId} />
      </AsyncSection>
    </main>
  )
}
