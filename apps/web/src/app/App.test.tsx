import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the booking screen with the service catalogue', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = new URL(url, window.location.origin).pathname
      if (path.endsWith('/bookings')) return Promise.resolve(Response.json([]))
      if (path.endsWith('/services')) {
        return Promise.resolve(
          Response.json([{ id: 1, name: 'Standard Screening', durationMinutes: 120 }]),
        )
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'حجوزات السينما' })).toBeDefined()
    expect(await screen.findByRole('option', { name: 'Standard Screening (١٢٠ دقيقة)' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'تأكيد الحجز' })).toBeDefined()
  })
})
