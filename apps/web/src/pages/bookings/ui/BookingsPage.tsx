import { useBookings } from '../model/useBookings'
import { BookingForm } from './BookingForm'
import { BookingList } from './BookingList'
import './bookings.css'

export function BookingsPage() {
  const { bookings, services, addBooking } = useBookings()

  return (
    <main className="bookings">
      <h1>Cinema bookings</h1>
      <p className="intro">Book a screening and see every booking stored by the API.</p>

      <div className="bookings-grid">
        <BookingForm services={services} onSubmit={addBooking} />

        <section aria-label="Existing bookings">
          <h2>Bookings</h2>
          <BookingList bookings={bookings} />
        </section>
      </div>
    </main>
  )
}
