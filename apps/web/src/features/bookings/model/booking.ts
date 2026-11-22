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

// Form values mirror the inputs (a <select> and <input type="datetime-local">
// both produce strings). Submit maps them to the API-shaped BookingInput.
export const bookingFormSchema = z.object({
  serviceId: z.string().min(1, 'Choose a service'),
  customerName: z.string().trim().min(1, 'Enter your name'),
  customerEmail: z.string().trim().pipe(z.email('Enter a valid email')),
  startsAt: z
    .string()
    .min(1, 'Choose a date and time')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Choose a date and time'),
})

export type BookingFormValues = z.infer<typeof bookingFormSchema>

export function toIsoFromLocal(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
