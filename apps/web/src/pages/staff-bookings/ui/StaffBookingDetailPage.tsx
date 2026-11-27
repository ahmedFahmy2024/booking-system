import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { formatCairoDateTime, formatEgp } from '@/shared/lib'
import { AsyncSection, Badge, Card, CardContent, Skeleton } from '@/shared/ui'
import { useStaffBooking, useStaffOccupancy } from '../model/useStaffBookings'
import type { StaffBookingsSearch } from '../model/staff-bookings'

function OccupancyPanel({ showtimeId }: { showtimeId: string }) {
  const { t, i18n } = useTranslation('staffBookings')
  const locale = i18n.resolvedLanguage ?? i18n.language
  const { data } = useStaffOccupancy(showtimeId)

  const stats = [
    [t('occupancyTotal'), data.totalSeats],
    [t('occupancyOutOfService'), data.outOfServiceSeats],
    [t('occupancyBooked'), data.bookedSeats],
    [t('occupancyAvailable'), data.availableSeats],
  ] as const

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('occupancyHeading')}</h2>
        <p className="text-sm text-muted-foreground">
          <bdi dir="auto">{data.filmTitle}</bdi> ·{' '}
          <bdi dir="auto">{formatCairoDateTime(data.startsAt, locale)}</bdi>
        </p>
        <dl className="grid gap-2 min-[701px]:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">{t('occupancyPercent', { percent: data.occupancyPercent })}</p>
      </CardContent>
    </Card>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd>
        <bdi dir="auto">{value}</bdi>
      </dd>
    </div>
  )
}

export function StaffBookingDetailPage({
  bookingId,
  backSearch,
}: {
  bookingId: string
  backSearch: StaffBookingsSearch
}) {
  const { t, i18n } = useTranslation('staffBookings')
  const locale = i18n.resolvedLanguage ?? i18n.language
  const { data } = useStaffBooking(bookingId)

  return (
    <main className="mx-auto flex max-w-[900px] flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('detailHeading')}</h1>
        <Link to="/staff/bookings" search={backSearch} className="underline underline-offset-4">
          {t('backToList')}
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">
              <bdi dir="auto">{data.reference}</bdi>
            </p>
            <Badge variant={data.status === 'cancelled' ? 'secondary' : 'default'}>
              {data.status === 'cancelled' ? t('statusCancelled') : t('statusConfirmed')}
            </Badge>
          </div>
          <dl className="flex flex-col gap-2">
            {data.kind === 'cinema' ? (
              <>
                <DetailLine label={t('film')} value={data.filmTitle} />
                <DetailLine label={t('auditorium')} value={data.auditoriumName} />
                <DetailLine label={t('seats')} value={data.seatLabels.join('، ')} />
              </>
            ) : (
              <DetailLine label={t('service')} value={data.serviceName ?? data.reference} />
            )}
            <DetailLine label={t('showtime')} value={formatCairoDateTime(data.startsAt, locale)} />
            <DetailLine label={t('guestName')} value={data.customerName} />
            <DetailLine label={t('email')} value={data.customerEmail} />
            {data.totalPiastres !== null && (
              <DetailLine label={t('total')} value={formatEgp(data.totalPiastres, locale)} />
            )}
            {data.cancelledAt && (
              <>
                <DetailLine label={t('cancelledAt')} value={formatCairoDateTime(data.cancelledAt, locale)} />
                {data.cancelledByUserId && (
                  <DetailLine label={t('cancelledBy')} value={data.cancelledByUserId} />
                )}
                {data.cancellationReason && (
                  <DetailLine label={t('cancellationReason')} value={data.cancellationReason} />
                )}
              </>
            )}
          </dl>
          <p className="text-sm text-muted-foreground">
            {data.guestLinkSent ? t('guestLinkSent') : t('guestLinkNotSent')}
          </p>
        </CardContent>
      </Card>

      {data.showtimeId && (
        <AsyncSection
          fallback={<Skeleton className="h-32 w-full" aria-hidden="true" />}
          errorTitle={t('occupancyLoadError')}
        >
          <OccupancyPanel showtimeId={data.showtimeId} />
        </AsyncSection>
      )}
    </main>
  )
}
