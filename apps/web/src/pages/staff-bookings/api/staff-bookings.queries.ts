import { queryOptions } from '@tanstack/react-query'
import {
  getStaffBooking,
  getStaffBookings,
  getStaffFilters,
  getStaffOccupancy,
} from './staff-bookings'
import type { StaffBookingsSearch } from '../model/staff-bookings'

export const staffBookingKeys = {
  list: (search: StaffBookingsSearch) =>
    [
      'staff-bookings',
      'list',
      {
        reference: search.reference,
        filmId: search.filmId,
        showtimeId: search.showtimeId,
        status: search.status,
        period: search.period,
        page: search.page,
        pageSize: search.pageSize,
      },
    ] as const,
  filters: ['staff-bookings', 'filters'] as const,
  detail: (id: string) => ['staff-bookings', 'detail', id] as const,
  occupancy: (showtimeId: string) => ['staff-bookings', 'occupancy', showtimeId] as const,
}

export const staffBookingsQuery = (search: StaffBookingsSearch) =>
  queryOptions({
    queryKey: staffBookingKeys.list(search),
    queryFn: () => getStaffBookings(search),
    // Keep the visible rows while a filter or page change fetches replacements.
    placeholderData: (previous) => previous,
  })

export const staffFiltersQuery = () =>
  queryOptions({
    queryKey: staffBookingKeys.filters,
    queryFn: getStaffFilters,
  })

export const staffBookingDetailQuery = (id: string) =>
  queryOptions({
    queryKey: staffBookingKeys.detail(id),
    queryFn: () => getStaffBooking(id),
  })

export const staffOccupancyQuery = (showtimeId: string) =>
  queryOptions({
    queryKey: staffBookingKeys.occupancy(showtimeId),
    queryFn: () => getStaffOccupancy(showtimeId),
  })
