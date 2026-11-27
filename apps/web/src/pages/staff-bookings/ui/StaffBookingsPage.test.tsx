import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaffBookingList, StaffFilters, StaffBookingsSearch } from '../model/staff-bookings'
import { StaffBookingsPage } from './StaffBookingsPage'

const mocks = vi.hoisted(() => ({
  useStaffBookings: vi.fn(),
  useStaffFilters: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('../model/useStaffBookings', () => ({
  useStaffBookings: mocks.useStaffBookings,
  useStaffFilters: mocks.useStaffFilters,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="#detail">{children}</a>,
}))

const search: StaffBookingsSearch = {
  reference: '',
  filmId: '',
  showtimeId: '',
  status: 'all',
  period: 'upcoming',
  page: 1,
  pageSize: 20,
}

const list: StaffBookingList = {
  items: [
    {
      id: '77777777-7777-4777-8777-777777777777',
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
  total: 21,
  page: 1,
  pageSize: 20,
  pageCount: 2,
}

const filters: StaffFilters = {
  films: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Cairo Nights' }],
  showtimes: [],
}

function updaterFrom(call: number): (previous: StaffBookingsSearch) => StaffBookingsSearch {
  const argument = mocks.navigate.mock.calls[call][0].search
  expect(typeof argument).toBe('function')
  return argument as (previous: StaffBookingsSearch) => StaffBookingsSearch
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.useStaffBookings.mockReturnValue({ data: list, isFetching: false })
  mocks.useStaffFilters.mockReturnValue({ data: filters })
})

describe('StaffBookingsPage', () => {
  it('shows upcoming defaults, a filtered row and pagination state', () => {
    render(<StaffBookingsPage search={search} />)
    expect(screen.getByRole('heading', { name: 'حجوزات العروض' })).toBeDefined()
    expect(screen.getByLabelText('رقم الحجز')).toHaveProperty('value', '')
    expect(screen.getByLabelText('الفترة')).toHaveProperty('value', 'upcoming')
    expect(screen.getByText('bkg_1')).toBeDefined()
    expect(screen.getAllByText('مؤكد')).toHaveLength(2)
    expect(screen.getByText('الصفحة 1 من 2')).toBeDefined()
    expect(screen.getByRole('button', { name: 'الصفحة السابقة' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'الصفحة التالية' })).toHaveProperty('disabled', false)
  })

  it('puts applied filters into the URL search patch and resets the page', () => {
    render(<StaffBookingsPage search={search} />)
    fireEvent.change(screen.getByLabelText('رقم الحجز'), { target: { value: 'bkg_1' } })
    fireEvent.change(screen.getByLabelText('الحالة'), { target: { value: 'cancelled' } })
    fireEvent.click(screen.getByRole('button', { name: 'تطبيق البحث' }))

    expect(updaterFrom(0)(search)).toEqual({
      ...search,
      reference: 'bkg_1',
      status: 'cancelled',
      page: 1,
    })
  })

  it('moves to the next page through a search patch', () => {
    render(<StaffBookingsPage search={search} />)
    fireEvent.click(screen.getByRole('button', { name: 'الصفحة التالية' }))
    expect(updaterFrom(0)(search).page).toBe(2)
  })

  it('shows an empty state when no rows match', () => {
    mocks.useStaffBookings.mockReturnValue({ data: { ...list, items: [], total: 0, pageCount: 0 }, isFetching: false })
    render(<StaffBookingsPage search={search} />)
    expect(screen.getByText('لا توجد حجوزات مطابقة.')).toBeDefined()
  })

  it('announces a refreshing result set without hiding the current rows', () => {
    mocks.useStaffBookings.mockReturnValue({ data: list, isFetching: true })
    render(<StaffBookingsPage search={search} />)
    expect(screen.getByRole('status').textContent).toContain('جارٍ تحديث النتائج...')
    expect(screen.getByText('bkg_1')).toBeDefined()
  })
})
