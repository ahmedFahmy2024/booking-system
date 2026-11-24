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
  type ConfirmedBooking,
} from '../model/checkout'
import { useConfirmBooking } from '../model/useConfirmBooking'
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
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null)
  const [failed, setFailed] = useState(false)
  const { mutate: confirm, isPending } = useConfirmBooking(showtimeId)

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

  function clearOutcome() {
    setConfirmed(null)
    setFailed(false)
  }

  function toggleSeat(seatId: string) {
    clearOutcome()
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

  const submit = handleSubmit((values) => {
    clearOutcome()
    confirm(toCheckoutRequest(showtimeId, values), {
      onSuccess: setConfirmed,
      onError: () => setFailed(true),
    })
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
                  {...register('email', { onChange: clearOutcome })}
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

              {failed && (
                <p role="alert" className="text-destructive text-sm font-medium">
                  {t('confirmFailed')}
                </p>
              )}
              {confirmed && (
                <p role="status" className="text-sm font-medium">
                  {t('bookingConfirmed', {
                    reference: confirmed.reference,
                    total: formatEgp(confirmed.totalPiastres, locale),
                  })}
                </p>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={bookingClosed || isPending}>
              {isPending ? t('confirming') : t('confirmSelection')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </FormProvider>
  )
}
