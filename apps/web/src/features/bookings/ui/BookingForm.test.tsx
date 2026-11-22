import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BookingInput } from '../model/booking'
import { BookingForm } from './BookingForm'

const services = [{ id: 1, name: 'Standard Screening', durationMinutes: 120 }]

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Ahmed' } })
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'ahmed@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Date and time'), {
    target: { value: '2026-12-01T10:00' },
  })
}

describe('BookingForm', () => {
  it('shows validation messages and does not submit when empty', async () => {
    const onSubmit = vi.fn()
    render(<BookingForm services={services} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    expect(await screen.findByText('Enter your name')).toBeDefined()
    expect(screen.getByText('Enter a valid email')).toBeDefined()
    expect(screen.getByText('Choose a service')).toBeDefined()
    expect(screen.getByText('Choose a date and time')).toBeDefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid booking with an ISO timestamp and resets the form', async () => {
    const onSubmit = vi.fn<(input: BookingInput) => Promise<void>>().mockResolvedValue(undefined)
    render(<BookingForm services={services} onSubmit={onSubmit} />)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const input = onSubmit.mock.calls[0][0]
    expect(input.serviceId).toBe(1)
    expect(input.customerName).toBe('Ahmed')
    expect(input.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    await waitFor(() =>
      expect(screen.getByLabelText('Customer name')).toHaveProperty('value', ''),
    )
  })

  it('shows a server error and keeps the entered values', async () => {
    const onSubmit = vi.fn<(input: BookingInput) => Promise<void>>().mockRejectedValue(
      new Error('That slot is taken'),
    )
    render(<BookingForm services={services} onSubmit={onSubmit} />)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    expect(await screen.findByText('That slot is taken')).toBeDefined()
    expect(screen.getByLabelText('Customer name')).toHaveProperty('value', 'Ahmed')
  })

  it('clears a previous server error on the next submit', async () => {
    const onSubmit = vi
      .fn<(input: BookingInput) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(undefined)
    render(<BookingForm services={services} onSubmit={onSubmit} />)

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))
    await screen.findByText('Network error')

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    await waitFor(() => expect(screen.queryByText('Network error')).toBeNull())
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })
})
