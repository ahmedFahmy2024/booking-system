import { z } from 'zod'

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

export function toIsoFromLocal(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

// The form holds raw input strings; the resolver yields API-shaped values.
// Deriving both types from one schema keeps the form and the submit callback honest.
export const bookingFormSchema = z.object({
  serviceId: z.coerce.number().int().positive('Choose a service'),
  customerName: z.string().trim().min(1, 'Enter your name'),
  customerEmail: z.string().trim().pipe(z.email('Enter a valid email')),
  startsAt: z
    .string()
    .min(1, 'Choose a date and time')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Choose a date and time')
    .transform(toIsoFromLocal),
})

export type BookingFormValues = z.input<typeof bookingFormSchema>
export type BookingFormOutput = z.output<typeof bookingFormSchema>
