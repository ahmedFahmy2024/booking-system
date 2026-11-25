import { afterEach, expect, it, vi } from 'vitest'
import { ApiRequestError, request } from './index'

afterEach(() => vi.unstubAllGlobals())

it.each([
  { body: JSON.stringify({ error: 'Access denied' }), message: 'Access denied' },
  { body: JSON.stringify({ error: { message: 'Invalid booking' } }), message: 'Invalid booking' },
  { body: JSON.stringify({ message: 'Film not found' }), message: 'Film not found' },
  { body: 'Service unavailable', message: 'Request failed (503)' },
])('reports the API error as "$message"', async ({ body, message }) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 503 })))

  await expect(request('/example')).rejects.toThrow(message)
})

it('keeps the API code and conflict details on the thrown error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'price_changed',
          unitPricePiastres: 3000,
          availableSeatIds: ['seat-1'],
        }),
        { status: 409 },
      ),
    ),
  )

  const error = await request('/example').catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(ApiRequestError)
  expect(error).toMatchObject({
    status: 409,
    code: 'price_changed',
    details: { unitPricePiastres: 3000, availableSeatIds: ['seat-1'] },
  })
  expect((error as Error).message).toBe('price_changed')
})

it('reports generic failures without an API code', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 503 })))

  const error = await request('/example').catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(ApiRequestError)
  expect((error as ApiRequestError).code).toBeNull()
  expect((error as ApiRequestError).details).toEqual({})
})
