import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '@/shared/api'
import { formatEgp } from '@/shared/lib'
import type { Seat } from '../model/showtime'

const mocks = vi.hoisted(() => ({ useSeatMap: vi.fn(), confirm: vi.fn(), isPending: false }))

vi.mock('../model/useSeatMap', () => ({ useSeatMap: mocks.useSeatMap }))
vi.mock('../model/useConfirmBooking', () => ({
  useConfirmBooking: () => ({ mutate: mocks.confirm, isPending: mocks.isPending }),
}))

import { CheckoutForm } from './CheckoutForm'

const showtimeId = '11111111-1111-4111-8111-111111111111'
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

const confirmedBooking = {
  id: '33333333-3333-4333-8333-333333333333',
  reference: `bkg_${'a'.repeat(32)}`,
  showtimeId,
  filmTitle: 'Cairo Nights',
  startsAt: '2026-12-01T12:00:00.000Z',
  auditoriumName: 'Hall 1',
  seatLabels: ['A1'],
  seatIds: [seatIds[0]],
  customerEmail: 'guest@example.com',
  unitPricePiastres: 2500,
  totalPiastres: 2500,
}

function renderForm() {
  return render(<CheckoutForm showtimeId={showtimeId} pricePiastres={2500} bookingClosed={false} />)
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
  vi.resetAllMocks()
  mocks.isPending = false
  mocks.useSeatMap.mockReturnValue({
    seatMap: {
      showtimeId: 'showtime-1',
      auditoriumName: 'Hall 1',
      seats: Array.from({ length: 7 }, (_, index) => seat(index)),
    },
  })
  mocks.confirm.mockImplementation(
    (_payload: unknown, options?: { onSuccess?: (value: typeof confirmedBooking) => void }) =>
      options?.onSuccess?.(confirmedBooking),
  )
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

  it('does not confirm without a seat', async () => {
    renderForm()

    submit()

    await waitFor(() => {
      expect(screen.getByText('اختر مقعدًا واحدًا على الأقل.')).toBeDefined()
    })
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(screen.queryByText(/تم تأكيد الحجز/)).toBeNull()
  })

  it('returns to the checkout form when a new seat is selected after success', async () => {
    renderForm()

    clickSeat(1)
    fireEvent.change(screen.getByLabelText('بريدك الإلكتروني'), {
      target: { value: 'guest@example.com' },
    })
    submit()
    await waitFor(() => {
      expect(screen.getByText(/تم تأكيد الحجز/)).toBeDefined()
    })
    // A confirmed seat is now unavailable to this guest, so the form clears it.
    expect(screen.getByRole('button', { name: 'المقعد A1 — متاح' }).getAttribute('aria-pressed')).toBe(
      'false',
    )

    clickSeat(1)
    expect(screen.queryByText(/تم تأكيد الحجز/)).toBeNull()
    expect(screen.getByLabelText('بريدك الإلكتروني')).toBeDefined()

    submit()
    await waitFor(() => {
      expect(screen.getByText(/تم تأكيد الحجز/)).toBeDefined()
    })
  })

  it('keeps the selection and email on a bad email, then confirms the retry', async () => {
    renderForm()
    const email = screen.getByLabelText('بريدك الإلكتروني')

    clickSeat(1)
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    submit()

    await waitFor(() => {
      expect(screen.getByText('أدخل بريدًا إلكترونيًا صحيحًا.')).toBeDefined()
    })
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect((email as HTMLInputElement).value).toBe('not-an-email')
    expect(screen.getByRole('button', { name: 'المقعد A1 — متاح' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.change(email, { target: { value: 'guest@example.com' } })
    submit()

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalledWith(
        {
          showtimeId,
          seatIds: [seatIds[0]],
          customerEmail: 'guest@example.com',
          quotedUnitPricePiastres: 2500,
        },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      )
    })
    expect(screen.getByText(/تم تأكيد الحجز/).textContent).toContain(confirmedBooking.reference)
    expect(screen.queryByText('أدخل بريدًا إلكترونيًا صحيحًا.')).toBeNull()
  })

  it('shows a localized error and keeps values when the API refuses the booking', async () => {
    renderForm()
    const email = screen.getByLabelText('بريدك الإلكتروني')
    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onError?: () => void }) => options?.onError?.(),
    )

    clickSeat(1)
    fireEvent.change(email, { target: { value: 'guest@example.com' } })
    submit()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })
    expect(screen.getByRole('alert').textContent).toContain('تعذّر تأكيد الحجز')
    expect((email as HTMLInputElement).value).toBe('guest@example.com')
    expect(screen.getByRole('button', { name: 'المقعد A1 — متاح' }).getAttribute('aria-pressed')).toBe('true')

    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onSuccess?: (value: typeof confirmedBooking) => void }) =>
        options?.onSuccess?.(confirmedBooking),
    )
    submit()
    await waitFor(() => {
      expect(screen.getByText(/تم تأكيد الحجز/)).toBeDefined()
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('prunes taken seats, keeps the others and the email, then confirms the retry', async () => {
    renderForm()
    const email = screen.getByLabelText('بريدك الإلكتروني')
    clickSeat(1)
    clickSeat(2)
    fireEvent.change(email, { target: { value: 'guest@example.com' } })
    mocks.confirm.mockImplementation(
      (
        _payload: unknown,
        options?: { onError?: (error: unknown) => void },
      ) =>
        options?.onError?.(
          new ApiRequestError('seat_unavailable', 409, 'seat_unavailable', {
            unitPricePiastres: 2500,
            availableSeatIds: [seatIds[0]],
          }),
        ),
    )

    submit()
    await waitFor(() => {
      expect(screen.getByText('بعض المقاعد المختارة لم تعد متاحة. راجع اختيارك وحاول مرة أخرى.')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: 'المقعد A1 — متاح' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'المقعد A2 — متاح' }).getAttribute('aria-pressed')).toBe('false')
    expect((email as HTMLInputElement).value).toBe('guest@example.com')

    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onSuccess?: (value: typeof confirmedBooking) => void }) =>
        options?.onSuccess?.(confirmedBooking),
    )
    submit()
    await waitFor(() => {
      expect(screen.getByText(/تم تأكيد الحجز/)).toBeDefined()
    })
    expect(mocks.confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ seatIds: [seatIds[0]] }),
      expect.anything(),
    )
  })

  it('requires an explicit action to accept a revised price', async () => {
    renderForm()
    clickSeat(1)
    fireEvent.change(screen.getByLabelText('بريدك الإلكتروني'), {
      target: { value: 'guest@example.com' },
    })
    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onError?: (error: unknown) => void }) =>
        options?.onError?.(
          new ApiRequestError('price_changed', 409, 'price_changed', {
            unitPricePiastres: 3000,
            availableSeatIds: [seatIds[0]],
          }),
        ),
    )

    submit()
    await waitFor(() => {
      expect(screen.getByText(/تغيّر سعر المقعد إلى/)).toBeDefined()
    })
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ quotedUnitPricePiastres: 2500 }),
      expect.anything(),
    )
    expect(screen.getByRole('button', { name: 'تأكيد الاختيار' })).toHaveProperty('disabled', true)
    const total = screen.getByText(
      (_, element) =>
        element?.tagName === 'P' && (element.textContent ?? '').startsWith('الإجمالي لـ'),
    )
    expect(total.textContent).toContain(formatEgp(3000, 'ar-EG'))

    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onSuccess?: (value: typeof confirmedBooking) => void }) =>
        options?.onSuccess?.(confirmedBooking),
    )
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجمالي الجديد' }))

    await waitFor(() => {
      expect(screen.getByText(/تم تأكيد الحجز/)).toBeDefined()
    })
    expect(mocks.confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ quotedUnitPricePiastres: 3000 }),
      expect.anything(),
    )
    expect(screen.queryByText(/تغيّر سعر المقعد إلى/)).toBeNull()
  })

  it('disables the revised-total action while a request is pending', async () => {
    const { rerender } = renderForm()
    clickSeat(1)
    fireEvent.change(screen.getByLabelText('بريدك الإلكتروني'), {
      target: { value: 'guest@example.com' },
    })
    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onError?: (error: unknown) => void }) =>
        options?.onError?.(
          new ApiRequestError('price_changed', 409, 'price_changed', {
            unitPricePiastres: 3000,
            availableSeatIds: [seatIds[0]],
          }),
        ),
    )

    submit()
    await waitFor(() => {
      expect(screen.getByText(/تغيّر سعر المقعد إلى/)).toBeDefined()
    })

    mocks.isPending = true
    rerender(<CheckoutForm showtimeId={showtimeId} pricePiastres={2500} bookingClosed={false} />)

    expect(screen.getByRole('button', { name: 'تأكيد الإجمالي الجديد' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('shows the confirmation screen with the booked details after success', async () => {
    renderForm()
    clickSeat(1)
    fireEvent.change(screen.getByLabelText('بريدك الإلكتروني'), {
      target: { value: 'guest@example.com' },
    })

    submit()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'تم تأكيد حجزك' })).toBeDefined()
    })
    const confirmation = within(screen.getByRole('region', { name: 'تم تأكيد حجزك' }))
    expect(confirmation.getByText('Cairo Nights')).toBeDefined()
    expect(confirmation.getByText('قاعة Hall 1')).toBeDefined()
    expect(
      confirmation.getByText(
        (_, element) => element?.tagName === 'DD' && element.textContent === 'A1',
      ),
    ).toBeDefined()
    expect(confirmation.getByText('ادفع المبلغ في المقر عند حضورك العرض.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'تأكيد الاختيار' })).toBeNull()
  })

  it('clears a pending price revision after a different failure and accepts a retry', async () => {
    renderForm()
    clickSeat(1)
    fireEvent.change(screen.getByLabelText('بريدك الإلكتروني'), {
      target: { value: 'guest@example.com' },
    })
    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onError?: (error: unknown) => void }) =>
        options?.onError?.(
          new ApiRequestError('price_changed', 409, 'price_changed', {
            unitPricePiastres: 3000,
            availableSeatIds: [seatIds[0]],
          }),
        ),
    )

    submit()
    await waitFor(() => {
      expect(screen.getByText(/تغيّر سعر المقعد إلى/)).toBeDefined()
    })

    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onError?: (error: unknown) => void }) =>
        options?.onError?.(new ApiRequestError('booking_closed', 409, 'booking_closed', {})),
    )
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجمالي الجديد' }))
    await waitFor(() => {
      expect(screen.getByText('انتهى وقت الحجز الإلكتروني لهذا العرض.')).toBeDefined()
    })
    expect(screen.queryByText(/تغيّر سعر المقعد إلى/)).toBeNull()
    expect(screen.getByRole('button', { name: 'تأكيد الاختيار' })).toHaveProperty('disabled', false)

    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onSuccess?: (value: typeof confirmedBooking) => void }) =>
        options?.onSuccess?.(confirmedBooking),
    )
    submit()
    await waitFor(() => {
      expect(screen.getByText(/تم تأكيد الحجز/)).toBeDefined()
    })
    expect(mocks.confirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ quotedUnitPricePiastres: 2500 }),
      expect.anything(),
    )
  })

  it('maps a known denial code to a localized message', async () => {
    renderForm()
    clickSeat(1)
    fireEvent.change(screen.getByLabelText('بريدك الإلكتروني'), {
      target: { value: 'guest@example.com' },
    })
    mocks.confirm.mockImplementation(
      (_payload: unknown, options?: { onError?: (error: unknown) => void }) =>
        options?.onError?.(new ApiRequestError('booking_closed', 409, 'booking_closed', {})),
    )

    submit()

    await waitFor(() => {
      expect(screen.getByText('انتهى وقت الحجز الإلكتروني لهذا العرض.')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: 'المقعد A1 — متاح' }).getAttribute('aria-pressed')).toBe('true')
  })
})
