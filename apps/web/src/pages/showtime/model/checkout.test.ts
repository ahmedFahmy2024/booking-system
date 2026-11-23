import { checkoutRequestSchema, MAX_BOOKING_SEATS } from '@booking-system/cinema-contracts'
import { describe, expect, it } from 'vitest'
import {
  checkoutFormSchema,
  checkoutTotalPiastres,
  emptyCheckoutFormValues,
  toCheckoutRequest,
} from './checkout'

const showtimeId = '11111111-1111-4111-8111-111111111111'
const seats = Array.from(
  { length: MAX_BOOKING_SEATS + 1 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
)
const payload = (seatIds: string[], customerEmail = 'guest@example.com') => ({
  showtimeId,
  seatIds,
  customerEmail,
})

describe('checkoutRequestSchema', () => {
  it('accepts one to six distinct seats and a guest email', () => {
    expect(checkoutRequestSchema.safeParse(payload([seats[0]])).success).toBe(true)
    expect(checkoutRequestSchema.safeParse(payload(seats.slice(0, 6))).success).toBe(true)
  })

  it('rejects an empty selection, a seventh seat and duplicate seats with distinct codes', () => {
    const message = (data: unknown) => {
      const result = checkoutRequestSchema.safeParse(data)
      return result.success ? '' : (result.error.issues[0]?.message ?? '')
    }

    expect(message(payload([]))).toBe('no_seat_selected')
    expect(message(payload(seats))).toBe('seat_limit')
    expect(message(payload([seats[0], seats[0]]))).toBe('duplicate_seat')
  })

  it('rejects a bad showtime id, bad seat id and bad email', () => {
    expect(checkoutRequestSchema.safeParse({ ...payload([seats[0]]), showtimeId: 'showtime-1' }).success).toBe(false)
    expect(checkoutRequestSchema.safeParse(payload(['seat-1'])).success).toBe(false)
    const emailResult = checkoutRequestSchema.safeParse(payload([seats[0]], 'not-an-email'))
    expect(emailResult.success).toBe(false)
    if (!emailResult.success) expect(emailResult.error.issues[0]?.message).toMatch(/email/i)
  })

  it('accepts a corrected payload after a rejected one', () => {
    expect(checkoutRequestSchema.safeParse(payload(seats)).success).toBe(false)
    expect(checkoutRequestSchema.safeParse(payload(seats.slice(0, 6))).success).toBe(true)
  })
})

describe('checkout form mapping', () => {
  it('starts with no seats and an empty email', () => {
    expect(emptyCheckoutFormValues()).toEqual({ seatIds: [], email: '' })
    expect(checkoutFormSchema.safeParse(emptyCheckoutFormValues()).success).toBe(false)
  })

  it('trims the email and maps it to the shared API field name', () => {
    const values = checkoutFormSchema.parse({ seatIds: [seats[0]], email: '  guest@example.com  ' })
    expect(values.email).toBe('guest@example.com')
    expect(toCheckoutRequest(showtimeId, values)).toEqual(payload([seats[0]]))
  })

  it('computes the total from the unit price in piastres', () => {
    expect(checkoutTotalPiastres(2500, 3)).toBe(7500)
    expect(checkoutTotalPiastres(2500, 0)).toBe(0)
  })
})
