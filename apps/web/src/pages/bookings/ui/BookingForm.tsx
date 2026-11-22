import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { NativeSelect, NativeSelectOption } from '@/shared/ui/native-select'
import { Spinner } from '@/shared/ui/spinner'
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
  const { t } = useTranslation('bookings')
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
    } catch {
      setError('root.serverError', { type: 'server' })
    }
  })

  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t('newBooking')}</CardTitle>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.serviceId)}>
              <FieldLabel htmlFor="serviceId">{t('service')}</FieldLabel>
              <NativeSelect
                id="serviceId"
                aria-invalid={Boolean(errors.serviceId)}
                {...register('serviceId')}
              >
                <NativeSelectOption value="">{t('selectService')}</NativeSelectOption>
                {services.map((service) => (
                  <NativeSelectOption key={service.id} value={service.id}>
                    {t('serviceOption', { name: service.name, count: service.durationMinutes })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.serviceId && <FieldError>{t('missingService')}</FieldError>}
            </Field>

            <Field data-invalid={Boolean(errors.customerName)}>
              <FieldLabel htmlFor="customerName">{t('customerName')}</FieldLabel>
              <Input
                id="customerName"
                dir="auto"
                aria-invalid={Boolean(errors.customerName)}
                {...register('customerName')}
              />
              {errors.customerName && <FieldError>{t('missingName')}</FieldError>}
            </Field>

            <Field data-invalid={Boolean(errors.customerEmail)}>
              <FieldLabel htmlFor="customerEmail">{t('email')}</FieldLabel>
              <Input
                id="customerEmail"
                type="email"
                dir="ltr"
                aria-invalid={Boolean(errors.customerEmail)}
                {...register('customerEmail')}
              />
              {errors.customerEmail && <FieldError>{t('invalidEmail')}</FieldError>}
            </Field>

            <Field data-invalid={Boolean(errors.startsAt)}>
              <FieldLabel htmlFor="startsAt">{t('dateAndTime')}</FieldLabel>
              <Input
                id="startsAt"
                type="datetime-local"
                aria-invalid={Boolean(errors.startsAt)}
                {...register('startsAt')}
              />
              {errors.startsAt && <FieldError>{t('invalidDate')}</FieldError>}
            </Field>
          </FieldGroup>

          {errors.root?.serverError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{t('saveError')}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            {isSubmitting ? t('saving') : t('createBooking')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
