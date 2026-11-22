import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/empty'
import type { Booking } from '../model/booking'

type BookingListProps = {
  bookings: Booking[]
}

export function BookingList({ bookings }: BookingListProps) {
  const { t, i18n } = useTranslation('bookings')
  if (bookings.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
          <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Card size="sm">
            <CardHeader>
            <CardTitle dir="auto">{booking.customerName}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="text-muted-foreground text-sm"><bdi>{booking.customerEmail}</bdi></span>
              <Badge variant="secondary" className="w-fit">
                <bdi>{booking.serviceName}</bdi>
              </Badge>
              <time className="text-muted-foreground text-sm" dateTime={booking.startsAt}>
                {t('dateAndTimeCairo', {
                  date: new Date(booking.startsAt).toLocaleString(i18n.resolvedLanguage, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Africa/Cairo',
                  }),
                })}
              </time>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
import { useTranslation } from 'react-i18next'
