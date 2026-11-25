const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

/** An HTTP failure with the API's machine-readable code and any conflict details. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string | null
  readonly details: Record<string, unknown>

  constructor(message: string, status: number, code: string | null, details: Record<string, unknown>) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiErrorInfo {
  message: string
  code: string | null
  details: Record<string, unknown>
}

async function readError(response: Response): Promise<ApiErrorInfo> {
  const fallback = `Request failed (${response.status})`
  const noDetails = { message: fallback, code: null, details: {} }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return noDetails
  }

  if (typeof body !== 'object' || body === null) return noDetails
  const record = body as Record<string, unknown>

  let message = fallback
  let code: string | null = null
  if ('error' in record) {
    const { error } = record
    if (typeof error === 'string') {
      code = error
      message = error
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message
    ) {
      message = error.message
    }
  }
  if (message === fallback && typeof record.message === 'string' && record.message) {
    message = record.message
  }

  const details = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== 'error' && key !== 'message'),
  )
  return { message, code, details }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    const { message, code, details } = await readError(response)
    throw new ApiRequestError(message, response.status, code, details)
  }

  return response.json() as Promise<T>
}
