import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useCatalogue: vi.fn() }))

vi.mock('../model/useCatalogue', () => ({ useCatalogue: mocks.useCatalogue }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode
    to: string
    params?: Record<string, string>
  }) => <a href={`/showtimes/${params?.showtimeId}`}>{children}</a>,
}))

import { CataloguePage } from './CataloguePage'

const film = {
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
}

describe('CataloguePage', () => {
  beforeEach(() => {
    mocks.useCatalogue.mockReturnValue({ films: [film] })
  })

  it('renders the film, its Cairo showtime and the EGP price', () => {
    render(<CataloguePage />)

    expect(screen.getByRole('heading', { name: 'الأفلام والعروض', level: 1 })).toBeDefined()
    expect(screen.getByText('Standard Screening')).toBeDefined()
    expect(screen.getByText(/٤:٠٠/)).toBeDefined()
    expect(screen.getByText(/ج\.م\./)).toBeDefined()
    expect(screen.getByRole('link', { name: 'عرض المقاعد' })).toBeDefined()
  })

  it('shows an empty state when there are no published showtimes', () => {
    mocks.useCatalogue.mockReturnValue({ films: [] })

    render(<CataloguePage />)

    expect(screen.getByText('لا توجد عروض متاحة حاليًا.')).toBeDefined()
    expect(screen.queryByRole('link', { name: 'عرض المقاعد' })).toBeNull()
  })
})
