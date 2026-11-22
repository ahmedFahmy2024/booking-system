import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  bookingFormSchema,
  type BookingFormOutput,
  type BookingFormValues,
  type BookingInput,
  type Service,
} from '../model/booking'

type BookingFormProps = {
  services: Service[]
  onSubmit: (input: BookingInput) => Promise<void>
}

export function BookingForm({ services, onSubmit }: BookingFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<BookingFormValues, unknown, BookingFormOutput>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      serviceId: '',
      customerName: '',
      customerEmail: '',
      startsAt: '',
    },
  })

  // Reset after the submit transition commits, not inside the submit handler.
  useEffect(() => {
    if (isSubmitSuccessful) reset()
  }, [isSubmitSuccessful, reset])

  const submit = handleSubmit(async (values) => {
    clearErrors('root.serverError')
    try {
      await onSubmit(values)
    } catch (cause) {
      setError('root.serverError', {
        type: 'server',
        message: cause instanceof Error ? cause.message : 'Could not save the booking',
      })
    }
  })

  return (
    <form className="booking-form" onSubmit={submit} noValidate>
      <h2>New booking</h2>

      <label htmlFor="serviceId">Service</label>
      <select
        id="serviceId"
        {...register('serviceId')}
        aria-invalid={Boolean(errors.serviceId)}
      >
        <option value="">Select a service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name} ({service.durationMinutes} min)
          </option>
        ))}
      </select>
      {errors.serviceId && <span role="alert">{errors.serviceId.message}</span>}

      <label htmlFor="customerName">Customer name</label>
      <input
        id="customerName"
        {...register('customerName')}
        aria-invalid={Boolean(errors.customerName)}
      />
      {errors.customerName && <span role="alert">{errors.customerName.message}</span>}

      <label htmlFor="customerEmail">Email</label>
      <input
        id="customerEmail"
        type="email"
        {...register('customerEmail')}
        aria-invalid={Boolean(errors.customerEmail)}
      />
      {errors.customerEmail && <span role="alert">{errors.customerEmail.message}</span>}

      <label htmlFor="startsAt">Date and time</label>
      <input
        id="startsAt"
        type="datetime-local"
        {...register('startsAt')}
        aria-invalid={Boolean(errors.startsAt)}
      />
      {errors.startsAt && <span role="alert">{errors.startsAt.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Create booking'}
      </button>

      {errors.root?.serverError && <p role="alert">{errors.root.serverError.message}</p>}
    </form>
  )
}
