const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

async function readError(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return fallback
  }

  if (typeof body !== 'object' || body === null) return fallback

  if ('error' in body) {
    const { error } = body
    if (typeof error === 'string') return error
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message
    ) {
      return error.message
    }
  }

  return 'message' in body && typeof body.message === 'string' && body.message
    ? body.message
    : fallback
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) throw new Error(await readError(response))

  return response.json() as Promise<T>
}
