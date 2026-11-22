import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@/features/bookings/api/bookings', () => ({
  listBookings: vi.fn().mockResolvedValue([]),
  listServices: vi
    .fn()
    .mockResolvedValue([{ id: 1, name: 'Standard Screening', durationMinutes: 120 }]),
  createBooking: vi.fn(),
}))

describe('App', () => {
  it('renders the booking screen with the service catalogue', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: /cinema bookings/i })).toBeDefined()
    expect(await screen.findByRole('option', { name: /standard screening/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /create booking/i })).toBeDefined()
  })
})
