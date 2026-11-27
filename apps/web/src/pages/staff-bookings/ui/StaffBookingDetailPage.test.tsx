import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaffBookingDetail, StaffBookingsSearch, StaffOccupancy } from '../model/staff-bookings'
import { StaffBookingDetailPage } from './StaffBookingDetailPage'

const mocks = vi.hoisted(() => ({
  useStaffBooking: vi.fn(),
  useStaffOccupancy: vi.fn(),
}))

vi.mock('../model/useStaffBookings', () => ({
  useStaffBooking: mocks.useStaffBooking,
  useStaffOccupancy: mocks.useStaffOccupancy,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/staff/bookings">{children}</a>,
}))

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>()
  return {
    ...actual,
    AsyncSection: ({ children }: { children: ReactNode }) => children,
  }
})

const backSearch: StaffBookingsSearch = {
  reference: 'bkg_1',
  filmId: '',
  showtimeId: '',
  status: 'cancelled',
  period: 'all',
  page: 2,
  pageSize: 20,
}

const cinemaDetail: StaffBookingDetail = {
  kind: 'cinema',
  id: '77777777-7777-4777-8777-777777777777',
  reference: 'bkg_1',
  status: 'cancelled',
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  cancelledAt: '2026-11-27T11:00:00.000Z',
  cancelledByUserId: 'admin-1',
  cancellationReason: 'Guest request',
  guestLinkSent: true,
  guestLinkExpiresAt: '2026-12-08T16:00:00.000Z',
  showtimeId: '44444444-4444-4444-8444-444444444444',
  showtimeStatus: 'cancelled',
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T16:00:00.000Z',
  auditoriumName: 'A1',
  seatLabels: ['A1', 'A2'],
}

const SHOWTIME_ID = '44444444-4444-4444-8444-444444444444'

const occupancy: StaffOccupancy = {
  showtimeId: SHOWTIME_ID,
  filmTitle: 'Cairo Nights',
  startsAt: cinemaDetail.startsAt,
  auditoriumName: 'A1',
  status: 'cancelled',
  totalSeats: 3,
  outOfServiceSeats: 1,
  bookedSeats: 1,
  availableSeats: 1,
  occupancyPercent: 50,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.useStaffBooking.mockReturnValue({ data: cinemaDetail })
  mocks.useStaffOccupancy.mockReturnValue({ data: occupancy })
})

describe('StaffBookingDetailPage', () => {
  it('renders frozen cinema details, cancellation attribution and occupancy', () => {
    render(<StaffBookingDetailPage bookingId={cinemaDetail.id} backSearch={backSearch} />)
    expect(screen.getByRole('heading', { name: 'تفاصيل الحجز' })).toBeDefined()
    expect(screen.getByText('bkg_1')).toBeDefined()
    expect(screen.getAllByText('Cairo Nights')).toHaveLength(2)
    expect(screen.getByText('A1، A2')).toBeDefined()
    expect(screen.getByText('Guest request')).toBeDefined()
    expect(screen.getByText('إشغال العرض')).toBeDefined()
    expect(screen.getByText(/50%/).textContent).toContain('50%')
    expect(mocks.useStaffOccupancy).toHaveBeenCalledWith(cinemaDetail.showtimeId)
    expect(screen.getByRole('link', { name: 'العودة إلى الحجوزات' })).toBeDefined()
  })

  it('renders a legacy prototype booking without a seat map section', () => {
    mocks.useStaffBooking.mockReturnValue({
      data: { ...cinemaDetail, kind: 'legacy', serviceName: 'Haircut', showtimeId: null },
    })
    render(<StaffBookingDetailPage bookingId={cinemaDetail.id} backSearch={backSearch} />)
    expect(screen.getByText('Haircut')).toBeDefined()
    expect(mocks.useStaffOccupancy).not.toHaveBeenCalled()
  })
})
