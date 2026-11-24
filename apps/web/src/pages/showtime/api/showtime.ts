import { request } from '@/shared/api'
import type { CheckoutRequest, ConfirmedBooking } from '../model/checkout'
import type { SeatMap, ShowtimeDetail } from '../model/showtime'

export function getShowtime(id: string): Promise<ShowtimeDetail> {
  return request<ShowtimeDetail>(`/showtimes/${encodeURIComponent(id)}`)
}

export function getSeatMap(id: string): Promise<SeatMap> {
  return request<SeatMap>(`/showtimes/${encodeURIComponent(id)}/seat-map`)
}

export function confirmBooking(payload: CheckoutRequest): Promise<ConfirmedBooking> {
  return request<ConfirmedBooking>('/bookings/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
