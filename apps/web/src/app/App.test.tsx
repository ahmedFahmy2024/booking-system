import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@/pages/bookings/api/bookings', () => ({
  listBookings: vi.fn().mockResolvedValue([]),
  listServices: vi
    .fn()
    .mockResolvedValue([{ id: 1, name: 'Standard Screening', durationMinutes: 120 }]),
  createBooking: vi.fn(),
}))

describe('App', () => {
  it('renders the booking screen with the service catalogue', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'حجوزات السينما' })).toBeDefined()
    expect(await screen.findByRole('option', { name: 'Standard Screening (١٢٠ دقيقة)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'تأكيد الحجز' })).toBeDefined()
  })
})
