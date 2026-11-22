import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../../app.js'

const mocks = vi.hoisted(() => {
  const from = vi.fn()
  return { select: vi.fn(() => ({ from })), from }
})

vi.mock('../../db/index.js', () => ({
  getDb: () => ({ select: mocks.select }),
}))

beforeEach(() => {
  mocks.select.mockClear()
  mocks.from.mockClear()
})

describe('services route', () => {
  it('returns the service catalogue', async () => {
    mocks.from.mockResolvedValueOnce([
      { id: 1, name: 'Standard Screening', durationMinutes: 120 },
      { id: 2, name: 'VIP Screening', durationMinutes: 150 },
    ])

    const res = await app.request('/services')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: 1, name: 'Standard Screening', durationMinutes: 120 },
      { id: 2, name: 'VIP Screening', durationMinutes: 150 },
    ])
  })
})
