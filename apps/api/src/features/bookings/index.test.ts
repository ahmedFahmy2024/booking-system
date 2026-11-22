import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../../app.js'

// The route calls getDb() at request time. Mock it so tests need no DATABASE_URL
// and never reach Neon. vi.hoisted runs before vi.mock is hoisted.
const mocks = vi.hoisted(() => {
  const innerJoin = vi.fn()
  const from = vi.fn(() => ({ innerJoin }))
  const returning = vi.fn()
  const values = vi.fn(() => ({ returning }))

  return {
    select: vi.fn(() => ({ from })),
    insert: vi.fn(() => ({ values })),
    innerJoin,
    values,
    returning,
  }
})

vi.mock('../../db/index.js', () => ({
  getDb: () => ({ select: mocks.select, insert: mocks.insert }),
}))

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockClear()
  }
})

const validPayload = {
  serviceId: 1,
  customerName: 'Ahmed',
  customerEmail: 'ahmed@example.com',
  startsAt: '2026-12-01T10:00:00.000Z',
}

describe('bookings routes', () => {
  it('lists bookings joined with their service name', async () => {
    mocks.innerJoin.mockResolvedValueOnce([
      {
        id: '11111111-1111-4111-8111-111111111111',
        customerName: 'Ahmed',
        customerEmail: 'ahmed@example.com',
        startsAt: new Date(validPayload.startsAt),
        serviceName: 'Haircut',
      },
    ])

    const res = await app.request('/bookings')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        customerName: 'Ahmed',
        customerEmail: 'ahmed@example.com',
        startsAt: validPayload.startsAt,
        serviceName: 'Haircut',
      },
    ])
  })

  it('creates a booking from valid input', async () => {
    const created = {
      id: '22222222-2222-4222-8222-222222222222',
      serviceId: validPayload.serviceId,
      customerName: validPayload.customerName,
      customerEmail: validPayload.customerEmail,
      startsAt: validPayload.startsAt,
    }
    mocks.returning.mockResolvedValueOnce([created])

    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(created)
    expect(mocks.values).toHaveBeenCalledWith({
      serviceId: validPayload.serviceId,
      customerName: validPayload.customerName,
      customerEmail: validPayload.customerEmail,
      startsAt: new Date(validPayload.startsAt),
    })
  })

  it('rejects invalid input before touching the database', async () => {
    const res = await app.request('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: 0,
        customerName: '',
        customerEmail: 'not-an-email',
        startsAt: 'not-a-date',
      }),
    })

    expect(res.status).toBe(400)
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
