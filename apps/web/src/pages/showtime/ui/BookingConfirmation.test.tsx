import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatCairoDateTime, formatEgp } from '@/shared/lib'
import type { ConfirmedBooking } from '../model/checkout'
import { BookingConfirmation } from './BookingConfirmation'

const booking: ConfirmedBooking = {
  id: '33333333-3333-4333-8333-333333333333',
  reference: `bkg_${'a'.repeat(32)}`,
  showtimeId: '11111111-1111-4111-8111-111111111111',
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T12:00:00.000Z',
  auditoriumName: 'Hall 1',
  seatLabels: ['A1', 'A2'],
  seatIds: ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002'],
  customerEmail: 'guest@example.com',
  unitPricePiastres: 2500,
  totalPiastres: 5000,
}

describe('BookingConfirmation', () => {
  it('shows the film, showtime, auditorium, seat labels, reference and accepted total', () => {
    render(<BookingConfirmation booking={booking} />)

    expect(screen.getByRole('heading', { name: 'تم تأكيد حجزك' })).toBeDefined()
    expect(screen.getByText('Cairo Nights')).toBeDefined()
    expect(screen.getByText('قاعة Hall 1')).toBeDefined()
    expect(screen.getByText('A1، A2')).toBeDefined()

    const time = screen.getByText(
      (_, element) => element?.tagName === 'TIME',
    )
    expect(time.textContent).toContain(formatCairoDateTime(booking.startsAt, 'ar-EG'))
    expect(time.getAttribute('datetime')).toBe(booking.startsAt)

    const status = screen.getByRole('status')
    expect(status.textContent).toContain(booking.reference)
    expect(status.textContent).toContain(formatEgp(booking.totalPiastres, 'ar-EG'))
    expect(screen.getByText('ادفع المبلغ في المقر عند حضورك العرض.')).toBeDefined()
    expect(screen.getByText(/أرسلنا رابطًا خاصًا/).textContent).toContain(booking.customerEmail)
  })

  it('never renders the private guest credential or a verifier', () => {
    render(<BookingConfirmation booking={booking} />)

    const text = document.body.textContent ?? ''
    expect(text).not.toContain('gl_')
    expect(text).not.toContain('token=')
    expect(text).not.toContain('guestLinkVerifier')
  })
})
