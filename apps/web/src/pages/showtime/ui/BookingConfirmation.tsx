import { useTranslation } from 'react-i18next'
import { formatCairoDateTime, formatEgp } from '@/shared/lib'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui'
import type { ConfirmedBooking } from '../model/checkout'

/**
 * The post-checkout screen. Every display field is server data from the
 * confirmation write, never a re-read of mutable catalogue state or the
 * private guest credential, which is only emailed.
 */
export function BookingConfirmation({ booking }: { booking: ConfirmedBooking }) {
  const { t, i18n } = useTranslation('catalogue')
  const locale = i18n.resolvedLanguage ?? i18n.language

  return (
    <Card role="region" aria-labelledby="booking-confirmation-heading">
      <CardHeader>
        <CardTitle id="booking-confirmation-heading" role="heading" aria-level={2}>
          {t('confirmationHeading')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p role="status" className="font-medium">
          {t('bookingConfirmed', {
            reference: booking.reference,
            total: formatEgp(booking.totalPiastres, locale),
          })}
        </p>
        <dl className="grid gap-2 sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted-foreground">{t('confirmFilm')}</dt>
          <dd dir="auto" className="font-medium">
            {booking.filmTitle}
          </dd>
          <dt className="text-muted-foreground">{t('confirmShowtime')}</dt>
          <dd>
            <time dateTime={booking.startsAt}>
              {t('showtimeCairo', { date: formatCairoDateTime(booking.startsAt, locale) })}
            </time>
          </dd>
          <dt className="text-muted-foreground">{t('confirmAuditorium')}</dt>
          <dd>
            <bdi>{t('auditorium', { name: booking.auditoriumName })}</bdi>
          </dd>
          <dt className="text-muted-foreground">{t('confirmSeats')}</dt>
          <dd dir="auto" className="font-medium">
            {booking.seatLabels.join(t('seatListSeparator'))}
          </dd>
          <dt className="text-muted-foreground">{t('confirmUnitPrice')}</dt>
          <dd>{formatEgp(booking.unitPricePiastres, locale)}</dd>
          <dt className="text-muted-foreground">{t('confirmTotal')}</dt>
          <dd className="font-medium">{formatEgp(booking.totalPiastres, locale)}</dd>
        </dl>
        <p>{t('venuePayment')}</p>
        <p className="text-muted-foreground">{t('privateLinkEmailed', { email: booking.customerEmail })}</p>
      </CardContent>
    </Card>
  )
}
