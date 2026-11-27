import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCairoDateTime, formatEgp } from '@/shared/lib'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui'
import { useGuestBooking } from '../model/useGuestBooking'
import { useGuestCancellation } from '../model/useGuestCancellation'
import { CancellationPanel } from './CancellationPanel'

/**
 * Guest view behind the private link. Every field comes from the owning API's
 * stored outcome; the credential is used for requests only and is never
 * rendered, linked or forwarded. Cancellation is an explicit two-step write.
 */
export function GuestBookingPage({ reference, token }: { reference: string; token: string }) {
  const { t, i18n } = useTranslation('guestBooking')
  const { booking } = useGuestBooking(reference, token)
  const cancellation = useGuestCancellation(reference, token)
  const [confirming, setConfirming] = useState(false)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const isCancelled = booking.status === 'cancelled'

  return (
    <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8">
      <Link to="/" className="text-primary text-sm underline underline-offset-4">
        {t('backToFilms')}
      </Link>
      <h1 dir="auto" className="text-2xl font-semibold">
        {t('heading')}
      </h1>
      <Card role="region" aria-labelledby="guest-booking-details-heading">
        <CardHeader>
          <CardTitle id="guest-booking-details-heading" role="heading" aria-level={2}>
            {t('detailsHeading')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p role="status" className="font-medium">
            {t('referenceLine', { reference: booking.reference })}
          </p>
          <dl className="grid gap-2 sm:grid-cols-[max-content_1fr]">
            {booking.kind === 'cinema' ? (
              <>
                <dt className="text-muted-foreground">{t('confirmFilm')}</dt>
                <dd dir="auto" className="font-medium">
                  {booking.filmTitle}
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
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">{t('guestName')}</dt>
                <dd dir="auto" className="font-medium">
                  {booking.customerName}
                </dd>
                <dt className="text-muted-foreground">{t('service')}</dt>
                <dd dir="auto">{booking.serviceName ?? '—'}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t('confirmShowtime')}</dt>
            <dd>
              <time dateTime={booking.startsAt}>
                {t('showtimeCairo', { date: formatCairoDateTime(booking.startsAt, locale) })}
              </time>
            </dd>
          </dl>
          {booking.kind === 'cinema' && !isCancelled && <p>{t('venuePayment')}</p>}
          {isCancelled && <p role="status">{t('cancelledNote')}</p>}
          <p className="text-muted-foreground">{t('emailNote', { email: booking.customerEmail })}</p>
          <p className="text-muted-foreground">{t('cancellationPolicy')}</p>
          <CancellationPanel
            canCancel={booking.canCancel}
            isCancelled={isCancelled}
            confirming={confirming}
            isPending={cancellation.isPending}
            isError={cancellation.isError}
            error={cancellation.error}
            onStart={() => setConfirming(true)}
            onConfirm={() => cancellation.mutate()}
            onKeep={() => setConfirming(false)}
          />
        </CardContent>
      </Card>
    </main>
  )
}
