import { useBookings } from '../model/useBookings'
import { BookingForm } from './BookingForm'
import { BookingList } from './BookingList'

export function BookingsPage() {
  const { t } = useTranslation('bookings')
  const { bookings, services, addBooking } = useBookings()

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">{t('heading')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-8 min-[701px]:grid-cols-[minmax(260px,1fr)_minmax(280px,1.2fr)]">
        <BookingForm services={services} onSubmit={addBooking} />

        <section aria-labelledby="bookings-heading" className="flex flex-col gap-3">
          <h2 id="bookings-heading" className="text-lg font-semibold">{t('listHeading')}</h2>
          <BookingList bookings={bookings} />
        </section>
      </div>
    </main>
  )
}
import { useTranslation } from 'react-i18next'
