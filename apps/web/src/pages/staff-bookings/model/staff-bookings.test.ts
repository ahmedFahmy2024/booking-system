import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '@/shared/api'
import {
  staffBookingDetailSchema,
  staffBookingErrorKey,
  staffBookingListSchema,
  staffBookingsQueryString,
  staffBookingsSearchSchema,
  staffFiltersSchema,
  staffOccupancySchema,
} from './staff-bookings'

const BOOKING_ID = '77777777-7777-4777-8777-777777777777'
const SHOWTIME_ID = '44444444-4444-4444-8444-444444444444'
const FILM_ID = '11111111-1111-4111-8111-111111111111'

const listBody = {
  items: [
    {
      id: BOOKING_ID,
      reference: 'bkg_1',
      status: 'confirmed',
      customerName: 'Ahmed',
      customerEmail: 'ahmed@example.com',
      filmTitle: 'Cairo Nights',
      serviceName: null,
      startsAt: '2026-12-01T16:00:00.000Z',
      auditoriumName: 'A1',
      seatCount: 2,
      unitPricePiastres: 2500,
      totalPiastres: 5000,
      cancelledAt: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  pageCount: 1,
}

const detailCommon = {
  id: BOOKING_ID,
  reference: 'bkg_1',
  status: 'cancelled',
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  cancelledAt: '2026-11-27T11:00:00.000Z',
  cancelledByUserId: 'admin-1',
  cancellationReason: 'Guest request',
  guestLinkSent: true,
  guestLinkExpiresAt: '2026-12-08T16:00:00.000Z',
  showtimeId: SHOWTIME_ID,
  showtimeStatus: 'cancelled',
  unitPricePiastres: 2500,
  totalPiastres: 5000,
}

describe('staff bookings boundary model', () => {
  it('defaults all URL filters to upcoming first-page results', () => {
    expect(staffBookingsSearchSchema.parse({})).toEqual({
      reference: '',
      filmId: '',
      showtimeId: '',
      status: 'all',
      period: 'upcoming',
      page: 1,
      pageSize: 20,
    })
    expect(staffBookingsSearchSchema.parse({ page: '3', pageSize: '10' }).page).toBe(3)
  })

  it('rejects invalid ids and out-of-range pages before a request', () => {
    expect(() => staffBookingsSearchSchema.parse({ filmId: 'bad' })).toThrow()
    expect(() => staffBookingsSearchSchema.parse({ page: 0 })).toThrow()
    expect(() => staffBookingsSearchSchema.parse({ pageSize: 101 })).toThrow()
  })

  it('serialises only supplied filters into the API query', () => {
    const search = staffBookingsSearchSchema.parse({
      reference: 'bkg_1',
      filmId: FILM_ID,
      status: 'cancelled',
      period: 'all',
      page: 2,
      pageSize: 10,
    })
    const params = new URLSearchParams(staffBookingsQueryString(search))
    expect(params.get('reference')).toBe('bkg_1')
    expect(params.get('filmId')).toBe(FILM_ID)
    expect(params.get('showtimeId')).toBeNull()
    expect(params.get('status')).toBe('cancelled')
    expect(params.get('period')).toBe('all')
    expect(params.get('page')).toBe('2')
    expect(params.get('pageSize')).toBe('10')
  })

  it('parses the list, filters, detail and occupancy responses', () => {
    expect(staffBookingListSchema.parse(listBody).total).toBe(1)
    expect(() => staffBookingListSchema.parse({ ...listBody, total: '1' })).toThrow()
    expect(
      staffFiltersSchema.parse({
        films: [{ id: FILM_ID, title: 'Cairo Nights' }],
        showtimes: [
          { id: SHOWTIME_ID, filmTitle: 'Cairo Nights', startsAt: '2026-12-01T16:00:00.000Z', auditoriumName: 'A1', status: 'published' },
        ],
      }).films,
    ).toHaveLength(1)
    expect(
      staffBookingDetailSchema.parse({
        ...detailCommon,
        filmTitle: 'Cairo Nights',
        startsAt: '2026-12-01T16:00:00.000Z',
        auditoriumName: 'A1',
        seatLabels: ['A1', 'A2'],
      }).kind,
    ).toBe('cinema')
    expect(
      staffBookingDetailSchema.parse({ ...detailCommon, serviceName: 'Haircut', startsAt: '2026-12-01T16:00:00.000Z' }).kind,
    ).toBe('legacy')
    expect(
      staffOccupancySchema.parse({
        showtimeId: SHOWTIME_ID,
        filmTitle: 'Cairo Nights',
        startsAt: '2026-12-01T16:00:00.000Z',
        auditoriumName: 'A1',
        status: 'published',
        totalSeats: 3,
        outOfServiceSeats: 1,
        bookedSeats: 1,
        availableSeats: 1,
        occupancyPercent: 50,
      }).occupancyPercent,
    ).toBe(50)
  })

  it('maps only known API codes to localized message keys', () => {
    expect(staffBookingErrorKey(new ApiRequestError('x', 404, 'booking_not_found', {}), 'detailLoadError')).toBe('bookingNotFound')
    expect(staffBookingErrorKey(new ApiRequestError('x', 409, 'showtime_not_ready', {}), 'detailLoadError')).toBe('showtimeNotReady')
    expect(staffBookingErrorKey(new Error('boom'), 'loadError')).toBe('loadError')
  })
})
