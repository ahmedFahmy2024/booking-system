import { z } from 'zod'
import { ApiRequestError } from '@/shared/api'

/** URL-owned filters and pagination. Empty ids mean "no filter" and are omitted from the API query. */
export const staffBookingsSearchSchema = z.object({
  reference: z.string().max(120).default(''),
  filmId: z.union([z.literal(''), z.uuid()]).default(''),
  showtimeId: z.union([z.literal(''), z.uuid()]).default(''),
  status: z.enum(['all', 'confirmed', 'cancelled']).default('all'),
  period: z.enum(['upcoming', 'all']).default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type StaffBookingsSearch = z.output<typeof staffBookingsSearchSchema>

export const BOOKING_STATUSES = ['confirmed', 'cancelled'] as const
export const SHOWTIME_STATUSES = ['draft', 'published', 'cancelled'] as const

const bookingItemSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.enum(BOOKING_STATUSES),
  customerName: z.string(),
  customerEmail: z.email(),
  filmTitle: z.string().nullable(),
  serviceName: z.string().nullable(),
  startsAt: z.string(),
  auditoriumName: z.string().nullable(),
  seatCount: z.number().int().nullable(),
  unitPricePiastres: z.number().int().nullable(),
  totalPiastres: z.number().int().nullable(),
  cancelledAt: z.string().nullable(),
})

export const staffBookingListSchema = z.object({
  items: z.array(bookingItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  pageCount: z.number().int(),
})
export type StaffBookingListItem = z.output<typeof bookingItemSchema>
export type StaffBookingList = z.output<typeof staffBookingListSchema>

const detailCommon = {
  id: z.uuid(),
  reference: z.string(),
  status: z.enum(BOOKING_STATUSES),
  customerName: z.string(),
  customerEmail: z.email(),
  cancelledAt: z.string().nullable(),
  cancelledByUserId: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  guestLinkSent: z.boolean(),
  guestLinkExpiresAt: z.string().nullable(),
  showtimeId: z.uuid().nullable(),
  showtimeStatus: z.enum(SHOWTIME_STATUSES).nullable(),
  unitPricePiastres: z.number().int().nullable(),
  totalPiastres: z.number().int().nullable(),
}

export const staffBookingDetailSchema = z.union([
  z
    .object({
      ...detailCommon,
      filmTitle: z.string(),
      startsAt: z.string(),
      auditoriumName: z.string(),
      seatLabels: z.array(z.string()),
    })
    .transform((detail) => ({ kind: 'cinema' as const, ...detail })),
  z
    .object({
      ...detailCommon,
      serviceName: z.string().nullable(),
      startsAt: z.string(),
    })
    .transform((detail) => ({ kind: 'legacy' as const, ...detail })),
])
export type StaffBookingDetail = z.output<typeof staffBookingDetailSchema>

export const staffFiltersSchema = z.object({
  films: z.array(z.object({ id: z.uuid(), title: z.string() })),
  showtimes: z.array(
    z.object({
      id: z.uuid(),
      filmTitle: z.string(),
      startsAt: z.string(),
      auditoriumName: z.string().nullable(),
      status: z.enum(SHOWTIME_STATUSES),
    }),
  ),
})
export type StaffFilters = z.output<typeof staffFiltersSchema>

export const staffOccupancySchema = z.object({
  showtimeId: z.uuid(),
  filmTitle: z.string(),
  startsAt: z.string(),
  auditoriumName: z.string(),
  status: z.enum(SHOWTIME_STATUSES),
  totalSeats: z.number().int(),
  outOfServiceSeats: z.number().int(),
  bookedSeats: z.number().int(),
  availableSeats: z.number().int(),
  occupancyPercent: z.number().int(),
})
export type StaffOccupancy = z.output<typeof staffOccupancySchema>

/** Serialise validated search params into the API query string. */
export function staffBookingsQueryString(search: StaffBookingsSearch): string {
  const params = new URLSearchParams({
    status: search.status,
    period: search.period,
    page: String(search.page),
    pageSize: String(search.pageSize),
  })
  if (search.reference) params.set('reference', search.reference)
  if (search.filmId) params.set('filmId', search.filmId)
  if (search.showtimeId) params.set('showtimeId', search.showtimeId)
  return params.toString()
}

export type StaffBookingMessageKey =
  | 'bookingNotFound'
  | 'showtimeNotFound'
  | 'showtimeNotReady'
  | 'loadError'
  | 'detailLoadError'

/** Only machine codes are surfaced; raw error text may contain a request URL. */
export function staffBookingErrorKey(
  error: unknown,
  fallback: 'loadError' | 'detailLoadError',
): StaffBookingMessageKey {
  const code = error instanceof ApiRequestError ? error.code : null
  if (code === 'booking_not_found') return 'bookingNotFound'
  if (code === 'showtime_not_found') return 'showtimeNotFound'
  if (code === 'showtime_not_ready') return 'showtimeNotReady'
  return fallback
}
