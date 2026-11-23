import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditoriumAdmin } from './AuditoriumAdmin'

const mocks = vi.hoisted(() => ({
  saveAuditorium: vi.fn(),
}))

vi.mock('../model/useCinemaAdmin', () => ({
  useAuditoriumsAdmin: () => ({ auditoriums: [], saveAuditorium: mocks.saveAuditorium }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.saveAuditorium.mockResolvedValue(undefined)
})

describe('AuditoriumAdmin seat-map editor', () => {
  it('renders a numbered row with keyboard-operable toggles that have text labels', () => {
    render(<AuditoriumAdmin />)

    expect(screen.getByText('خريطة المقاعد')).toBeDefined()
    expect(screen.getByText('A1')).toBeDefined()
    expect(screen.getByText('A10')).toBeDefined()
    const outOfService = screen.getAllByLabelText('خارج الخدمة')
    const aisles = screen.getAllByLabelText('ممر بعد المقعد')
    expect(outOfService).toHaveLength(10)
    expect(aisles).toHaveLength(10)
    for (const checkbox of outOfService) {
      expect(checkbox).toHaveProperty('type', 'checkbox')
    }
  })

  it('adds a seat, marks it out of service, and saves a normalised seat map', async () => {
    render(<AuditoriumAdmin />)

    fireEvent.change(screen.getByLabelText('اسم القاعة'), { target: { value: 'Main Hall' } })
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مقعد' }))
    expect(screen.getByText('A11')).toBeDefined()

    const toggles = screen.getAllByLabelText('خارج الخدمة')
    fireEvent.click(toggles[0])
    fireEvent.click(screen.getByRole('button', { name: 'إضافة القاعة' }))

    await waitFor(() => expect(mocks.saveAuditorium).toHaveBeenCalledTimes(1))
    const input = mocks.saveAuditorium.mock.calls[0][0]
    expect(input.name).toBe('Main Hall')
    expect(input.seats).toHaveLength(11)
    expect(input.seats[0]).toEqual({
      rowLabel: 'A',
      seatNumber: 1,
      aisleAfter: false,
      isOutOfService: true,
    })
  })

  it('adds a row with the next label and removes it again', async () => {
    render(<AuditoriumAdmin />)

    fireEvent.change(screen.getByLabelText('اسم القاعة'), { target: { value: 'Main Hall' } })
    fireEvent.click(screen.getByRole('button', { name: 'إضافة صف' }))
    expect(screen.getByText('B1')).toBeDefined()

    fireEvent.click(screen.getAllByRole('button', { name: 'حذف الصف' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'إضافة القاعة' }))

    await waitFor(() => expect(mocks.saveAuditorium).toHaveBeenCalledTimes(1))
    const labels = new Set(mocks.saveAuditorium.mock.calls[0][0].seats.map((s: { rowLabel: string }) => s.rowLabel))
    expect([...labels]).toEqual(['A'])
  })

  it('keeps the edited map and shows an error when saving fails', async () => {
    mocks.saveAuditorium.mockRejectedValueOnce(new Error('forbidden'))

    render(<AuditoriumAdmin />)
    fireEvent.change(screen.getByLabelText('اسم القاعة'), { target: { value: 'Main Hall' } })
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مقعد' }))
    fireEvent.click(screen.getByRole('button', { name: 'إضافة القاعة' }))

    expect(await screen.findByText('تعذر الحفظ. حاول مرة أخرى.')).toBeDefined()
    expect(screen.getByText('A11')).toBeDefined()
    expect(screen.getByLabelText('اسم القاعة')).toHaveProperty('value', 'Main Hall')
  })
})
