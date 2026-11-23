import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatEgp } from '@/shared/lib'
import type { Seat } from '../model/showtime'

const mocks = vi.hoisted(() => ({ useSeatMap: vi.fn() }))

vi.mock('../model/useSeatMap', () => ({ useSeatMap: mocks.useSeatMap }))

import { CheckoutForm } from './CheckoutForm'

const seatIds = Array.from(
  { length: 7 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
)
const seat = (index: number): Seat => ({
  id: seatIds[index],
  rowLabel: 'A',
  seatNumber: index + 1,
  aisleAfter: false,
  outOfService: false,
  available: true,
})

function renderForm() {
  return render(
    <CheckoutForm
      showtimeId="11111111-1111-4111-8111-111111111111"
      pricePiastres={2500}
      bookingClosed={false}
    />,
  )
}

function clickSeat(number: number) {
  fireEvent.click(screen.getByRole('button', { name: `المقعد A${number} — متاح` }))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'تأكيد الاختيار' }))
}

/** Intl inserts direction marks around EGP; compare text content, not normalized text. */
function expectPrice(prefix: string, piastres: number) {
  const node = screen.getByText(
    (_, element) => element?.tagName === 'P' && (element.textContent ?? '').includes(prefix),
  )
  expect(node.textContent).toContain(formatEgp(piastres, 'ar-EG'))
}

beforeEach(() => {
  mocks.useSeatMap.mockReturnValue({
    seatMap: {
      showtimeId: 'showtime-1',
      auditoriumName: 'Hall 1',
      seats: Array.from({ length: 7 }, (_, index) => seat(index)),
    },
  })
})

describe('CheckoutForm', () => {
  it('shows the unit price and a live total for the selected seats', () => {
    renderForm()

    expectPrice('سعر المقعد', 2500)
    expectPrice('الإجمالي', 0)

    clickSeat(1)
    clickSeat(2)
    expectPrice('الإجمالي', 5000)
    expect(screen.getByText('المقاعد المختارة: A1، A2')).toBeDefined()

    clickSeat(2)
    expectPrice('الإجمالي', 2500)
  })

  it('refuses a seventh seat and keeps the six-seat total', () => {
    renderForm()

    for (let number = 1; number <= 6; number += 1) clickSeat(number)
    clickSeat(7)

    expect(screen.getByText('يمكنك اختيار 6 مقاعد كحد أقصى.')).toBeDefined()
    expectPrice('الإجمالي', 15000)
    expect(screen.getByRole('button', { name: 'المقعد A7 — متاح' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('requires a seat before showing a ready selection', async () => {
    renderForm()

    submit()

    await waitFor(() => {
      expect(screen.getByText('اختر مقعدًا واحدًا على الأقل.')).toBeDefined()
    })
    expect(screen.queryByText(/تم التحقق من الاختيار/)).toBeNull()
  })

  it('clears a stale ready summary when the email or seats change after submitting', async () => {
    renderForm()
    const email = screen.getByLabelText('بريدك الإلكتروني')

    clickSeat(1)
    fireEvent.change(email, { target: { value: 'guest@example.com' } })
    submit()
    await waitFor(() => {
      expect(screen.getByText(/تم التحقق من الاختيار/)).toBeDefined()
    })

    fireEvent.change(email, { target: { value: 'another@example.com' } })
    expect(screen.queryByText(/تم التحقق من الاختيار/)).toBeNull()

    submit()
    await waitFor(() => {
      expect(screen.getByText(/تم التحقق من الاختيار/)).toBeDefined()
    })
    clickSeat(2)
    expect(screen.queryByText(/تم التحقق من الاختيار/)).toBeNull()
  })

  it('keeps the selection and email on a bad email, then accepts the retry', async () => {
    renderForm()
    const email = screen.getByLabelText('بريدك الإلكتروني')

    clickSeat(1)
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الاختيار' }))

    await waitFor(() => {
      expect(screen.getByText('أدخل بريدًا إلكترونيًا صحيحًا.')).toBeDefined()
    })
    expect(screen.queryByText(/تم التحقق من الاختيار/)).toBeNull()
    expect((email as HTMLInputElement).value).toBe('not-an-email')
    expect(screen.getByRole('button', { name: 'المقعد A1 — متاح' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.change(email, { target: { value: 'guest@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الاختيار' }))

    await waitFor(() => {
      expect(screen.getByText(/تم التحقق من الاختيار: 1 مقعد/).textContent).toContain('guest@example.com')
    })
    expect(screen.queryByText('أدخل بريدًا إلكترونيًا صحيحًا.')).toBeNull()
  })
})
