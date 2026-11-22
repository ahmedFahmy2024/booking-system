export interface Service {
  id: number
  name: string
  durationMinutes: number
}

export interface Booking {
  id: string
  customerName: string
  customerEmail: string
  startsAt: string
  serviceName: string
}

export interface CreatedBooking {
  id: string
  serviceId: number
  customerName: string
  customerEmail: string
  startsAt: string
  createdAt: string
}

export interface BookingInput {
  serviceId: number
  customerName: string
  customerEmail: string
  startsAt: string
}

export type BookingErrors = Partial<Record<keyof BookingInput, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function toIsoFromLocal(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function validateBookingInput(input: BookingInput): BookingErrors {
  const errors: BookingErrors = {}

  if (!Number.isInteger(input.serviceId) || input.serviceId <= 0) {
    errors.serviceId = 'Choose a service'
  }
  if (!input.customerName.trim()) {
    errors.customerName = 'Enter your name'
  }
  if (!EMAIL_PATTERN.test(input.customerEmail.trim())) {
    errors.customerEmail = 'Enter a valid email'
  }
  if (!input.startsAt || Number.isNaN(new Date(input.startsAt).getTime())) {
    errors.startsAt = 'Choose a date and time'
  }

  return errors
}
