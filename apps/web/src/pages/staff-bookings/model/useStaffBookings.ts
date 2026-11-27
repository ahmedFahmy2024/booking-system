import { useSuspenseQuery } from '@tanstack/react-query'
import { staffBookingsQuery, staffFiltersQuery, staffBookingDetailQuery, staffOccupancyQuery } from '../api/staff-bookings.queries'
import type { StaffBookingsSearch } from './staff-bookings'

/** Route loaders prime these queries; the hooks read the same options. */
export function useStaffBookings(search: StaffBookingsSearch) {
  return useSuspenseQuery(staffBookingsQuery(search))
}

export function useStaffFilters() {
  return useSuspenseQuery(staffFiltersQuery())
}

export function useStaffBooking(id: string) {
  return useSuspenseQuery(staffBookingDetailQuery(id))
}

export function useStaffOccupancy(showtimeId: string) {
  return useSuspenseQuery(staffOccupancyQuery(showtimeId))
}
