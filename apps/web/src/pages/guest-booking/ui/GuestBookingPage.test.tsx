import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/shared/api'

const token = `gl_${'A'.repeat(43)}`

const mocks = vi.hoisted(() => ({
  useGuestBooking: vi.fn(),
  useGuestCancellation: vi.fn(),
}))

vi.mock('../model/useGuestBooking', () => ({ useGuestBooking: mocks.useGuestBooking }))
vi.mock('../model/useGuestCancellation', () => ({ useGuestCancellation: mocks.useGuestCancellation }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode; to: string }) => <a href="/">{children}</a>,
}))

import { GuestBookingPage } from './GuestBookingPage'

const cinemaBooking = {
  kind: 'cinema' as const,
  id: '33333333-3333-4333-8333-333333333333',
  reference: `bkg_${'a'.repeat(32)}`,
  showtimeId: '11111111-1111-4111-8111-111111111111',
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T12:00:00.000Z',
  auditoriumName: 'Hall 1',
  seatLabels: ['A1', 'A2'],
  unitPricePiastres: 2500,
  totalPiastres: 5000,
  customerEmail: 'guest@example.com',
  status: 'confirmed',
  canCancel: true,
}

const legacyBooking = {
  kind: 'legacy' as const,
  id: '44444444-4444-4444-8444-444444444444',
  reference: `bkg_${'b'.repeat(32)}`,
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  startsAt: '2026-12-01T12:00:00.000Z',
  serviceName: 'Haircut',
  status: 'confirmed',
  canCancel: false,
}

function mockCancellation(overrides: Record<string, unknown> = {}) {
  mocks.useGuestCancellation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  })
}

describe('GuestBookingPage', () => {
  beforeEach(() => {
    mocks.useGuestBooking.mockReturnValue({ booking: cinemaBooking })
    mockCancellation()
  })

  it('shows the frozen cinema details and never renders the private token', () => {
    const { container } = render(<GuestBookingPage reference={cinemaBooking.reference} token={token} />)

    expect(screen.getByRole('heading', { name: 'تفاصيل حجزك', level: 1 })).toBeDefined()
    const card = screen.getByRole('region', { name: 'تفاصيل الحجز' })
    expect(card).toBeDefined()
    expect(screen.getByRole('status').textContent).toContain(cinemaBooking.reference)
    expect(screen.getByText('Cairo Nights')).toBeDefined()
    expect(screen.getByText('قاعة Hall 1')).toBeDefined()
    expect(screen.getByText('A1، A2', { exact: true })).toBeDefined()
    expect(screen.getByText('ادفع المبلغ في المقر عند حضورك العرض.')).toBeDefined()
    expect(screen.getByText(/guest@example.com/)).toBeDefined()
    expect(document.body.textContent).not.toContain(token)
    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('href')).not.toContain(token)
    }
  })

  it('still renders a legacy booking that has no frozen snapshot', () => {
    mocks.useGuestBooking.mockReturnValue({ booking: legacyBooking })

    render(<GuestBookingPage reference={legacyBooking.reference} token={token} />)

    expect(screen.getByText('Ahmed')).toBeDefined()
    expect(screen.getByText('Haircut')).toBeDefined()
    expect(screen.getByRole('status').textContent).toContain(legacyBooking.reference)
    expect(screen.queryByText('Cairo Nights')).toBeNull()
    expect(screen.queryByRole('button', { name: 'إلغاء الحجز' })).toBeNull()
  })

  it('requires explicit confirmation before calling the cancellation write', () => {
    const mutate = vi.fn()
    mockCancellation({ mutate })

    render(<GuestBookingPage reference={cinemaBooking.reference} token={token} />)
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء الحجز' }))

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/هل تريد إلغاء هذا الحجز كاملًا/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإلغاء' }))
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).not.toContain(token)
  })

  it('shows a localized error and keeps the confirmation open on a closed booking', () => {
    mockCancellation({
      isError: true,
      error: new ApiRequestError('cancellation_closed', 409, 'cancellation_closed', {}),
    })

    render(<GuestBookingPage reference={cinemaBooking.reference} token={token} />)
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء الحجز' }))

    expect(screen.getByRole('alert').textContent).toContain('انتهت مهلة الإلغاء')
    expect(screen.getByRole('button', { name: 'تأكيد الإلغاء' })).toBeDefined()
    expect(screen.getByText(/guest@example.com/)).toBeDefined()
  })

  it('shows the cancelled state without a cancel action or venue-payment prompt', () => {
    mocks.useGuestBooking.mockReturnValue({
      booking: { ...cinemaBooking, status: 'cancelled', canCancel: false },
    })

    render(<GuestBookingPage reference={cinemaBooking.reference} token={token} />)

    expect(screen.getByText(/تم إلغاء الحجز/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'إلغاء الحجز' })).toBeNull()
    expect(screen.queryByText('ادفع المبلغ في المقر عند حضورك العرض.')).toBeNull()
    expect(document.body.textContent).not.toContain(token)
  })
})
