import { afterEach, expect, it, vi } from 'vitest'
import { request } from './index'

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
