import { request } from '@/shared/api'
import {
  staffBookingDetailSchema,
  staffBookingListSchema,
  staffFiltersSchema,
  staffOccupancySchema,
  staffBookingsQueryString,
  type StaffBookingsSearch,
} from '../model/staff-bookings'

/** Every response is parsed at the boundary so the UI never trusts raw JSON. */
export function getStaffBookings(search: StaffBookingsSearch) {
  return request(`/staff/bookings?${staffBookingsQueryString(search)}`).then((body) =>
    staffBookingListSchema.parse(body),
  )
}

export function getStaffFilters() {
  return request('/staff/bookings/filters').then((body) => staffFiltersSchema.parse(body))
}

export function getStaffBooking(id: string) {
  return request(`/staff/bookings/${encodeURIComponent(id)}`).then((body) =>
    staffBookingDetailSchema.parse(body),
  )
}

export function getStaffOccupancy(showtimeId: string) {
  return request(`/staff/showtimes/${encodeURIComponent(showtimeId)}/occupancy`).then((body) =>
    staffOccupancySchema.parse(body),
  )
}
