import type {
  Booking,
  BookingInput,
  CreatedBooking,
  Service,
} from '../model/booking'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string } | string
      message?: string
    }
    if (typeof body.error === 'string') return body.error
    if (body.error?.message) return body.error.message
    if (body.message) return body.message
  } catch {
    // Non-JSON error response — fall back to the status code.
  }
  return `Request failed (${response.status})`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.json() as Promise<T>
}

export function listBookings(): Promise<Booking[]> {
  return request<Booking[]>('/bookings')
}

export function listServices(): Promise<Service[]> {
  return request<Service[]>('/services')
}

export function createBooking(input: BookingInput): Promise<CreatedBooking> {
  return request<CreatedBooking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
