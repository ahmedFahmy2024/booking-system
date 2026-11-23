import { MAX_BOOKING_SEATS } from '@booking-system/cinema-contracts'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { formatEgp } from '@/shared/lib'
import {
  AsyncSection,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@/shared/ui'
import {
  checkoutFormSchema,
  checkoutTotalPiastres,
  emptyCheckoutFormValues,
  toCheckoutRequest,
  type CheckoutFormOutput,
  type CheckoutFormValues,
  type CheckoutRequest,
} from '../model/checkout'
import { SeatMapPending } from './SeatMapPending'
import { SeatMapSection } from './SeatMapSection'

type CheckoutFormProps = {
  showtimeId: string
  pricePiastres: number
  bookingClosed: boolean
}

export function CheckoutForm({ showtimeId, pricePiastres, bookingClosed }: CheckoutFormProps) {
  const { t, i18n } = useTranslation('catalogue')
  const locale = i18n.resolvedLanguage ?? i18n.language
  const [atSeatLimit, setAtSeatLimit] = useState(false)
  const [submitted, setSubmitted] = useState<CheckoutRequest | null>(null)

  const form = useForm<CheckoutFormValues, unknown, CheckoutFormOutput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: emptyCheckoutFormValues(),
  })
  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = form

  // A single subscription drives the selected map, the total and the summary.
  const seatIds = useWatch({ control, name: 'seatIds' }) ?? []
  const totalPiastres = checkoutTotalPiastres(pricePiastres, seatIds.length)

  function toggleSeat(seatId: string) {
    setSubmitted(null)
    const current = getValues('seatIds')
    if (current.includes(seatId)) {
      setAtSeatLimit(false)
      setValue('seatIds', current.filter((id) => id !== seatId), {
        shouldValidate: true,
        shouldDirty: true,
      })
      return
    }
    if (current.length >= MAX_BOOKING_SEATS) {
      setAtSeatLimit(true)
      return
    }
    setAtSeatLimit(false)
    setValue('seatIds', [...current, seatId], { shouldValidate: true, shouldDirty: true })
  }

  // B4.2 replaces this validated summary with the atomic confirmation write.
  const submit = handleSubmit((values) => {
    setSubmitted(toCheckoutRequest(showtimeId, values))
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <AsyncSection errorTitle={t('seatMapLoadError')} fallback={<SeatMapPending />}>
          <SeatMapSection
            showtimeId={showtimeId}
            selectedSeatIds={seatIds}
            onToggleSeat={toggleSeat}
            atSeatLimit={atSeatLimit}
          />
        </AsyncSection>

        <Card>
          <CardHeader>
            <CardTitle>{t('checkoutHeading')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="guestEmail">{t('guestEmail')}</FieldLabel>
                <Input
                  id="guestEmail"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'guestEmail-error' : undefined}
                  {...register('email', { onChange: () => setSubmitted(null) })}
                />
                {errors.email && <FieldError id="guestEmail-error">{t('invalidEmail')}</FieldError>}
              </Field>

              {errors.seatIds && <FieldError>{t('noSeatSelected')}</FieldError>}

              <div className="flex flex-col gap-1 text-sm">
                <p>{t('unitPrice', { price: formatEgp(pricePiastres, locale) })}</p>
                <p aria-live="polite" className="font-medium">
                  {t('totalPrice', {
                    seatCount: seatIds.length,
                    total: formatEgp(totalPiastres, locale),
                  })}
                </p>
              </div>

              {submitted && (
                <p role="status" className="text-sm font-medium">
                  {t('checkoutReady', {
                    seatCount: submitted.seatIds.length,
                    total: formatEgp(totalPiastres, locale),
                    email: submitted.customerEmail,
                  })}
                </p>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={bookingClosed}>
              {t('confirmSelection')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </FormProvider>
  )
}
