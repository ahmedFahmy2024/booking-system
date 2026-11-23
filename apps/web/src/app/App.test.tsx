import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the public film catalogue in Arabic', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = new URL(url, window.location.origin).pathname
      if (path.endsWith('/films')) {
        return Promise.resolve(
          Response.json([
            {
              id: 'film-1',
              title: 'Standard Screening',
              durationMinutes: 120,
              synopsis: 'A synopsis',
              posterUrl: null,
              showtimes: [
                {
                  id: 'showtime-1',
                  startsAt: '2026-12-01T14:00:00.000Z',
                  pricePiastres: 2500,
                  auditoriumName: 'Hall 1',
                },
              ],
            },
          ]),
        )
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'الأفلام والعروض' })).toBeDefined()
    expect(screen.getByText('Standard Screening')).toBeDefined()
    expect(screen.getByRole('link', { name: 'عرض المقاعد' })).toBeDefined()
  })
})
