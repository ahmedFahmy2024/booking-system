import { useState, type FormEvent } from 'react'
import {
  toIsoFromLocal,
  validateBookingInput,
  type BookingErrors,
  type BookingInput,
  type Service,
} from '../model/booking'

type BookingFormProps = {
  services: Service[]
  onSubmit: (input: BookingInput) => Promise<void>
}

export function BookingForm({ services, onSubmit }: BookingFormProps) {
  const [serviceId, setServiceId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [errors, setErrors] = useState<BookingErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const input: BookingInput = {
      serviceId: Number(serviceId),
      customerName,
      customerEmail,
      startsAt: toIsoFromLocal(startsAt),
    }

    const nextErrors = validateBookingInput(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(input)
      setServiceId('')
      setCustomerName('')
      setCustomerEmail('')
      setStartsAt('')
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Could not save the booking')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit} noValidate>
      <h2>New booking</h2>

      <label htmlFor="serviceId">Service</label>
      <select
        id="serviceId"
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
        aria-invalid={Boolean(errors.serviceId)}
      >
        <option value="">Select a service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name} ({service.durationMinutes} min)
          </option>
        ))}
      </select>
      {errors.serviceId && <span role="alert">{errors.serviceId}</span>}

      <label htmlFor="customerName">Customer name</label>
      <input
        id="customerName"
        value={customerName}
        onChange={(event) => setCustomerName(event.target.value)}
        aria-invalid={Boolean(errors.customerName)}
      />
      {errors.customerName && <span role="alert">{errors.customerName}</span>}

      <label htmlFor="customerEmail">Email</label>
      <input
        id="customerEmail"
        type="email"
        value={customerEmail}
        onChange={(event) => setCustomerEmail(event.target.value)}
        aria-invalid={Boolean(errors.customerEmail)}
      />
      {errors.customerEmail && <span role="alert">{errors.customerEmail}</span>}

      <label htmlFor="startsAt">Date and time</label>
      <input
        id="startsAt"
        type="datetime-local"
        value={startsAt}
        onChange={(event) => setStartsAt(event.target.value)}
        aria-invalid={Boolean(errors.startsAt)}
      />
      {errors.startsAt && <span role="alert">{errors.startsAt}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Create booking'}
      </button>

      {submitError && <p role="alert">{submitError}</p>}
    </form>
  )
}
