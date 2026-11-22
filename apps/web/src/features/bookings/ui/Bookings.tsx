import { useBookings } from '../model/useBookings'
import { BookingForm } from './BookingForm'
import { BookingList } from './BookingList'
import './bookings.css'

export function Bookings() {
  const { bookings, services, isLoading, error, addBooking } = useBookings()

  return (
    <main className="bookings">
      <h1>Cinema bookings</h1>
      <p className="intro">Book a screening and see every booking stored by the API.</p>

      {error && <p role="alert">{error}</p>}

      <div className="bookings-grid">
        <BookingForm services={services} onSubmit={addBooking} />

        <section aria-label="Existing bookings">
          <h2>Bookings</h2>
          {isLoading ? <p>Loading…</p> : <BookingList bookings={bookings} />}
        </section>
      </div>
    </main>
  )
}
