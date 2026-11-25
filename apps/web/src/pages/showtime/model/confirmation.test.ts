import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '@/shared/api'
import { confirmationErrorKey, readConfirmationFailure } from './confirmation'

describe('readConfirmationFailure', () => {
  it('reads a structured conflict without interpreting UI text', () => {
    const error = new ApiRequestError('price_changed', 409, 'price_changed', {
      unitPricePiastres: 3000,
      availableSeatIds: ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002'],
    })

    expect(readConfirmationFailure(error)).toEqual({
      code: 'price_changed',
      unitPricePiastres: 3000,
      availableSeatIds: ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002'],
    })
  })

  it('keeps the code but no details when a denial has no conflict body', () => {
    const error = new ApiRequestError('booking_closed', 409, 'booking_closed', {})

    expect(readConfirmationFailure(error)).toEqual({
      code: 'booking_closed',
      unitPricePiastres: null,
      availableSeatIds: null,
    })
  })

  it('treats a non-API error as generic', () => {
    expect(readConfirmationFailure(new Error('network down'))).toEqual({
      code: null,
      unitPricePiastres: null,
      availableSeatIds: null,
    })
  })
})

describe('confirmationErrorKey', () => {
  it.each([
    ['seat_unavailable', 'seatsTaken'],
    ['booking_closed', 'bookingClosedError'],
    ['showtime_not_found', 'showtimeNotFound'],
    ['too_many_requests', 'tooManyRequests'],
    ['invalid_seat', 'confirmFailed'],
    [null, 'confirmFailed'],
  ] as const)('maps %s to %s', (code, key) => {
    expect(confirmationErrorKey(code)).toBe(key)
  })
})
