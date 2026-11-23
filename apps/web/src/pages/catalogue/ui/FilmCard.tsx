import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formatCairoDateTime, formatEgp } from '@/shared/lib'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/ui'
import type { FilmWithShowtimes } from '../model/catalogue'

export function FilmCard({ film }: { film: FilmWithShowtimes }) {
  const { t, i18n } = useTranslation('catalogue')
  const locale = i18n.resolvedLanguage ?? i18n.language

  return (
    <Card className="overflow-hidden">
      {film.posterUrl && (
        <img src={film.posterUrl} alt="" loading="lazy" className="max-h-64 w-full object-cover" />
      )}
      <CardHeader>
        <CardTitle dir="auto">{film.title}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {t('duration', { count: film.durationMinutes })}
        </p>
      </CardHeader>
      <CardContent>
        <p dir="auto" className="text-sm">
          {film.synopsis}
        </p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <h2 className="font-medium text-sm">{t('showtimesHeading')}</h2>
        {film.showtimes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('noShowtimes')}</p>
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {film.showtimes.map((showtime) => (
              <li
                key={showtime.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <time dateTime={showtime.startsAt}>
                    {t('showtimeCairo', {
                      date: formatCairoDateTime(showtime.startsAt, locale),
                    })}
                  </time>
                  <span className="text-muted-foreground">
                    <bdi>{showtime.auditoriumName}</bdi>
                    {' · '}
                    {t('pricePerSeat', { price: formatEgp(showtime.pricePiastres, locale) })}
                  </span>
                </div>
                <Link
                  to="/showtimes/$showtimeId"
                  params={{ showtimeId: showtime.id }}
                  className="text-primary text-sm underline underline-offset-4"
                >
                  {t('viewSeats')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardFooter>
    </Card>
  )
}
