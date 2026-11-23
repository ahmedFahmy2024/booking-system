import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditoriumAdmin } from './AuditoriumAdmin'

const mocks = vi.hoisted(() => ({
  saveAuditorium: vi.fn(),
}))

vi.mock('../model/useAuditoriumsAdmin', () => ({
  useAuditoriumsAdmin: () => ({ auditoriums, saveAuditorium: mocks.saveAuditorium }),
}))

const auditoriums = [{
  id: 'hall-1',
  name: 'Existing Hall',
  seats: [{ id: 'seat-1', rowLabel: 'A', seatNumber: 1, aisleAfter: false, isOutOfService: false }],
}]

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

  it('updates the preview when the aisle checkbox is toggled', () => {
    render(<AuditoriumAdmin />)
    const seat = screen.getByText('A1').closest('li')
    const aisle = screen.getAllByLabelText('ممر بعد المقعد')[0]

    fireEvent.click(aisle)
    expect(seat?.style.marginInlineEnd).toBe('1rem')

    fireEvent.click(aisle)
    expect(seat?.style.marginInlineEnd).toBe('')
  })

  it('uses a free row label after removing a row and editing a label', async () => {
    render(<AuditoriumAdmin />)
    fireEvent.change(screen.getByLabelText('اسم القاعة'), { target: { value: 'Main Hall' } })
    const addRow = screen.getByRole('button', { name: 'إضافة صف' })
    fireEvent.click(addRow)
    fireEvent.click(screen.getAllByRole('button', { name: 'حذف الصف' })[0])
    fireEvent.click(addRow)
    expect(screen.getAllByText('B1')).toHaveLength(1)
    expect(screen.getAllByText('A1')).toHaveLength(1)

    const [firstLabel] = screen.getAllByLabelText('الصف')
    fireEvent.change(firstLabel, { target: { value: ' c ' } })
    fireEvent.click(addRow)
    expect(screen.getByText('B1')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'إضافة القاعة' }))
    await waitFor(() => expect(mocks.saveAuditorium).toHaveBeenCalledTimes(1))
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

  it('prevents switching editors until a pending save fails', async () => {
    let failSave: (error: Error) => void = () => {}
    mocks.saveAuditorium.mockReturnValueOnce(new Promise<void>((_, reject) => { failSave = reject }))
    render(<AuditoriumAdmin />)

    const edit = screen.getByRole('button', { name: 'تعديل' })
    fireEvent.click(edit)
    const cancel = screen.getByRole('button', { name: 'إلغاء التعديل' })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }))
    await waitFor(() => expect(mocks.saveAuditorium).toHaveBeenCalledTimes(1))
    expect(edit).toHaveProperty('disabled', true)
    expect(cancel).toHaveProperty('disabled', true)

    await act(async () => { failSave(new Error('unavailable')) })
    expect(await screen.findByText('تعذر الحفظ. حاول مرة أخرى.')).toBeDefined()
    expect(edit).toHaveProperty('disabled', false)
    expect(cancel).toHaveProperty('disabled', false)
    expect(screen.getByLabelText('اسم القاعة')).toHaveProperty('value', 'Existing Hall')
  })
})
