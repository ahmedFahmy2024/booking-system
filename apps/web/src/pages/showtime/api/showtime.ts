import { request } from '@/shared/api'
import type { CheckoutRequest, ConfirmedBooking } from '../model/checkout'
import type { SeatMap, ShowtimeDetail } from '../model/showtime'

export function getShowtime(id: string): Promise<ShowtimeDetail> {
  return request<ShowtimeDetail>(`/showtimes/${encodeURIComponent(id)}`)
}

export function getSeatMap(id: string): Promise<SeatMap> {
  return request<SeatMap>(`/showtimes/${encodeURIComponent(id)}/seat-map`)
}

/** D4: the stable key travels in a header, separate from the confirmed payload. */
export interface ConfirmBookingInput {
  checkout: CheckoutRequest
  idempotencyKey: string
}

export function confirmBooking({ checkout, idempotencyKey }: ConfirmBookingInput): Promise<ConfirmedBooking> {
  return request<ConfirmedBooking>('/bookings/confirm', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(checkout),
  })
}
