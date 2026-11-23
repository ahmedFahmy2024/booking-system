import { request } from '@/shared/api'
import type {
  Booking,
  BookingInput,
  CreatedBooking,
  Service,
} from '../model/booking'

export function listBookings(): Promise<Booking[]> {
  return request<Booking[]>('/bookings')
}

export function listServices(): Promise<Service[]> {
  return request<Service[]>('/services')
}

export function createBooking(input: BookingInput): Promise<CreatedBooking> {
  return request<CreatedBooking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
