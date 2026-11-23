import { fireEvent, render, screen } from '@testing-library/react'
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

const onToggleSeat = vi.fn()

function renderMap(overrides: { selectedSeatIds?: string[]; atSeatLimit?: boolean } = {}) {
  return render(
    <SeatMapSection
      showtimeId="showtime-1"
      selectedSeatIds={overrides.selectedSeatIds ?? []}
      onToggleSeat={onToggleSeat}
      atSeatLimit={overrides.atSeatLimit ?? false}
    />,
  )
}

describe('SeatMapSection', () => {
  beforeEach(() => {
    onToggleSeat.mockClear()
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
    renderMap()

    const available = screen.getByRole('button', { name: 'المقعد A1 — متاح' })
    const unavailable = screen.getByRole('button', { name: 'المقعد A2 — خارج الخدمة' })
    expect(available.tagName).toBe('BUTTON')
    expect(available.getAttribute('aria-disabled')).toBe('false')
    expect(available.getAttribute('aria-pressed')).toBe('false')
    expect(unavailable.getAttribute('aria-disabled')).toBe('true')
    expect(unavailable.getAttribute('aria-pressed')).toBeNull()
    expect(screen.getByRole('group', { name: 'الصف A' })).toBeDefined()
  })

  it('renders the aisle as spacing without adding a control', () => {
    renderMap()

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

    renderMap()

    expect(screen.getByText('لا توجد مقاعد متاحة لهذا العرض.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'المقعد A1 — خارج الخدمة' })).toBeDefined()
  })

  it('selects and deselects an available seat through its button', () => {
    const { rerender } = renderMap()
    const available = screen.getByRole('button', { name: 'المقعد A1 — متاح' })

    fireEvent.click(available)
    expect(onToggleSeat).toHaveBeenCalledWith('seat-1')

    rerender(
      <SeatMapSection
        showtimeId="showtime-1"
        selectedSeatIds={['seat-1']}
        onToggleSeat={onToggleSeat}
        atSeatLimit={false}
      />,
    )
    expect(available.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('المقاعد المختارة: A1')).toBeDefined()
  })

  it('does not offer an unavailable seat as a toggle', () => {
    renderMap()

    fireEvent.click(screen.getByRole('button', { name: 'المقعد A2 — خارج الخدمة' }))
    expect(onToggleSeat).not.toHaveBeenCalled()
  })

  it('announces the seat limit without changing the map', () => {
    renderMap({ selectedSeatIds: ['seat-1'], atSeatLimit: true })

    expect(screen.getByText('يمكنك اختيار 6 مقاعد كحد أقصى.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'المقعد A1 — متاح' }).getAttribute('aria-pressed')).toBe('true')
  })
})
