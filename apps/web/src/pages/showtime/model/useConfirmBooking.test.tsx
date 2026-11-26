import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('../api/showtime', () => ({ confirmBooking: mocks.confirm }))

import { useConfirmBooking } from './useConfirmBooking'

const showtimeId = '11111111-1111-4111-8111-111111111111'
const SEAT_1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const SEAT_2 = 'aaaaaaaa-0000-4000-8000-000000000002'

function checkout(seatIds: string[], quotedUnitPricePiastres = 2500) {
  return { showtimeId, seatIds, customerEmail: 'guest@example.com', quotedUnitPricePiastres }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

async function attempt(mutateAsync: (input: ReturnType<typeof checkout>) => Promise<unknown>) {
  await act(async () => {
    await mutateAsync(checkout([SEAT_1])).catch(() => undefined)
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('useConfirmBooking idempotency key', () => {
  it('sends a UUID header key that survives an unchanged retry and rotates on a new payload', async () => {
    mocks.confirm.mockRejectedValue(new Error('lost response'))
    const { result } = renderHook(() => useConfirmBooking(showtimeId), { wrapper: makeWrapper() })

    await attempt(result.current.mutateAsync)
    const firstKey = mocks.confirm.mock.calls[0][0].idempotencyKey as string
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

    await attempt(result.current.mutateAsync)
    expect(mocks.confirm.mock.calls[1][0].idempotencyKey).toBe(firstKey)

    mocks.confirm.mockResolvedValue({})
    await act(async () => {
      await result.current.mutateAsync(checkout([SEAT_1, SEAT_2]))
    })
    expect(mocks.confirm.mock.calls[2][0].idempotencyKey).not.toBe(firstKey)
  })

  it('starts a fresh attempt after a confirmed booking', async () => {
    mocks.confirm.mockResolvedValue({})
    const { result } = renderHook(() => useConfirmBooking(showtimeId), { wrapper: makeWrapper() })

    await attempt(result.current.mutateAsync)
    const firstKey = mocks.confirm.mock.calls[0][0].idempotencyKey as string

    await attempt(result.current.mutateAsync)
    expect(mocks.confirm.mock.calls[1][0].idempotencyKey).not.toBe(firstKey)
  })

  it('keeps the key across a page reload after a lost response', async () => {
    mocks.confirm.mockRejectedValue(new Error('lost response'))
    const first = renderHook(() => useConfirmBooking(showtimeId), { wrapper: makeWrapper() })
    await attempt(first.result.current.mutateAsync)
    const key = mocks.confirm.mock.calls[0][0].idempotencyKey as string
    first.unmount()

    const reloaded = renderHook(() => useConfirmBooking(showtimeId), { wrapper: makeWrapper() })
    await attempt(reloaded.result.current.mutateAsync)

    expect(mocks.confirm.mock.calls[1][0].idempotencyKey).toBe(key)
  })

  it('clears the stored key after a confirmed booking', async () => {
    mocks.confirm.mockRejectedValue(new Error('lost response'))
    const first = renderHook(() => useConfirmBooking(showtimeId), { wrapper: makeWrapper() })
    await attempt(first.result.current.mutateAsync)
    expect(sessionStorage.getItem(`booking-checkout:${showtimeId}`)).not.toBeNull()
    first.unmount()

    mocks.confirm.mockResolvedValue({})
    const reloaded = renderHook(() => useConfirmBooking(showtimeId), { wrapper: makeWrapper() })
    await attempt(reloaded.result.current.mutateAsync)
    expect(sessionStorage.getItem(`booking-checkout:${showtimeId}`)).toBeNull()

    await attempt(reloaded.result.current.mutateAsync)
    expect(mocks.confirm.mock.calls[2][0].idempotencyKey).not.toBe(
      mocks.confirm.mock.calls[0][0].idempotencyKey,
    )
  })
})
