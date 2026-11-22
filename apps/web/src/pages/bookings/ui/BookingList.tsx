import type { Booking } from '../model/booking'

type BookingListProps = {
  bookings: Booking[]
}

export function BookingList({ bookings }: BookingListProps) {
  if (bookings.length === 0) {
    return <p className="empty">No bookings yet.</p>
  }

  return (
    <ul className="booking-list">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <strong>{booking.customerName}</strong>
          <span>{booking.customerEmail}</span>
          <span>{booking.serviceName}</span>
          <time dateTime={booking.startsAt}>
            {new Date(booking.startsAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  )
}
