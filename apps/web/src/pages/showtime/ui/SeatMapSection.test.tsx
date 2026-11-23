import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Seat } from '../model/showtime'

const mocks = vi.hoisted(() => ({ useSeatMap: vi.fn() }))

vi.mock('../model/useSeatMap', () => ({ useSeatMap: mocks.useSeatMap }))

import { SeatMapSection } from './SeatMapSection'

const seat = (overrides: Partial<Seat> = {}): Seat => ({
  id: 'seat-1',
  rowLabel: 'A',
  seatNumber: 1,
  aisleAfter: false,
  outOfService: false,
  available: true,
  ...overrides,
})

describe('SeatMapSection', () => {
  beforeEach(() => {
    mocks.useSeatMap.mockReturnValue({
      seatMap: {
        showtimeId: 'showtime-1',
        auditoriumName: 'Hall 1',
        seats: [
          seat({ aisleAfter: true }),
          seat({ id: 'seat-2', seatNumber: 2, outOfService: true, available: false }),
        ],
      },
    })
  })

  it('exposes each labelled seat with its availability to assistive technology', () => {
    render(<SeatMapSection showtimeId="showtime-1" />)

    const available = screen.getByRole('button', { name: 'المقعد A1 — متاح' })
    const unavailable = screen.getByRole('button', { name: 'المقعد A2 — خارج الخدمة' })
    expect(available.tagName).toBe('BUTTON')
    expect(available.getAttribute('aria-disabled')).toBe('false')
    expect(unavailable.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('group', { name: 'الصف A' })).toBeDefined()
  })

  it('renders the aisle as spacing without adding a control', () => {
    render(<SeatMapSection showtimeId="showtime-1" />)

    const available = screen.getByRole('button', { name: 'المقعد A1 — متاح' })
    expect(available.style.marginInlineEnd).toBe('1rem')
  })

  it('announces a sold-out showtime while keeping the map readable', () => {
    mocks.useSeatMap.mockReturnValue({
      seatMap: {
        showtimeId: 'showtime-1',
        auditoriumName: 'Hall 1',
        seats: [seat({ outOfService: true, available: false })],
      },
    })

    render(<SeatMapSection showtimeId="showtime-1" />)

    expect(screen.getByRole('status').textContent).toContain('لا توجد مقاعد متاحة')
    expect(screen.getByRole('button', { name: 'المقعد A1 — خارج الخدمة' })).toBeDefined()
  })
})
