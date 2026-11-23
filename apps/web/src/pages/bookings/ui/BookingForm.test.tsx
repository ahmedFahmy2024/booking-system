import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { bookingFormSchema, type BookingInput } from '../model/booking'
import { BookingForm } from './BookingForm'

const services = [{ id: 1, name: 'Standard Screening', durationMinutes: 120 }]

const saveError = 'تعذر حفظ الحجز. حاول مرة أخرى.'

function renderForm(onSubmit: (input: BookingInput) => Promise<void>) {
  render(<BookingForm services={services} onSubmit={onSubmit} />)
}

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText('الخدمة'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('اسم العميل'), { target: { value: 'Ahmed' } })
  fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), {
    target: { value: 'ahmed@example.com' },
  })
  fireEvent.change(screen.getByLabelText('التاريخ والوقت بتوقيت جهازك'), {
    target: { value: '2026-12-01T10:00' },
  })
}

describe('BookingForm', () => {
  it('shows validation messages and does not submit when empty', async () => {
    const onSubmit = vi.fn()
    renderForm(onSubmit)

    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحجز' }))

    expect(await screen.findByText('أدخل اسمك')).toBeDefined()
    expect(screen.getByText('أدخل بريدًا إلكترونيًا صحيحًا')).toBeDefined()
    expect(screen.getByText('اختر إحدى الخدمات')).toBeDefined()
    expect(screen.getByText('اختر تاريخًا ووقتًا صالحين')).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid booking with an ISO timestamp and resets the form', async () => {
    const onSubmit = vi.fn<(input: BookingInput) => Promise<void>>().mockResolvedValue(undefined)
    renderForm(onSubmit)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحجز' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const input = onSubmit.mock.calls[0][0]
    expect(input.serviceId).toBe(1)
    expect(input.customerName).toBe('Ahmed')
    expect(input.startsAt).toBe(new Date('2026-12-01T10:00').toISOString())
    await waitFor(() =>
      expect(screen.getByLabelText('اسم العميل')).toHaveProperty('value', ''),
    )
  })

  it('shows a server error and keeps the entered values', async () => {
    const onSubmit = vi.fn<(input: BookingInput) => Promise<void>>().mockRejectedValue(
      new Error('That slot is taken'),
    )
    renderForm(onSubmit)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحجز' }))

    expect(await screen.findByText(saveError)).toBeDefined()
    expect(screen.getByLabelText('اسم العميل')).toHaveProperty('value', 'Ahmed')
  })

  it('clears a previous server error on the next submit', async () => {
    const onSubmit = vi
      .fn<(input: BookingInput) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(undefined)
    renderForm(onSubmit)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحجز' }))
    await screen.findByText(saveError)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحجز' }))

    await waitFor(() => expect(screen.queryByText(saveError)).toBeNull())
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })
})

describe('Booking date validation', () => {
  it.each(['0', '2026-02-30T10:00', '2026-12-01T10:00:00Z', '2026-12-01T10:00:00+02:00'])(
    'rejects %s as a datetime-local value',
    (startsAt) => {
      const result = bookingFormSchema.safeParse({
        serviceId: '1',
        customerName: 'Ahmed',
        customerEmail: 'ahmed@example.com',
        startsAt,
      })
      expect(result.error?.issues[0]?.path).toEqual(['startsAt'])
    },
  )
})
