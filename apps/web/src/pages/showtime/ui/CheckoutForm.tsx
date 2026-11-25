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
import {
  confirmationErrorKey,
  readConfirmationFailure,
  type ConfirmationErrorKey,
} from '../model/confirmation'
import { useConfirmBooking } from '../model/useConfirmBooking'
import { BookingConfirmation } from './BookingConfirmation'
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
  const [errorKey, setErrorKey] = useState<ConfirmationErrorKey | null>(null)
  const [priceRevision, setPriceRevision] = useState<number | null>(null)
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
  // An acknowledged price change supersedes the cached detail until success.
  const displayedPricePiastres = priceRevision ?? pricePiastres
  const totalPiastres = checkoutTotalPiastres(displayedPricePiastres, seatIds.length)

  function clearOutcome() {
    setConfirmed(null)
    setErrorKey(null)
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

  function onSuccess(value: ConfirmedBooking) {
    setConfirmed(value)
    setErrorKey(null)
    setPriceRevision(null)
    // The refreshed map marks these seats unavailable to everyone, including
    // this guest, so they must not stay selected as if still choosable.
    setValue('seatIds', [], { shouldDirty: true })
  }

  function onError(error: unknown) {
    const failure = readConfirmationFailure(error)
    setConfirmed(null)
    if (failure.code === 'price_changed' && failure.unitPricePiastres !== null) {
      // Never accept a changed total implicitly: wait for the explicit action.
      setPriceRevision(failure.unitPricePiastres)
      setErrorKey(null)
      return
    }
    // A later failure supersedes the pending revision: the guest must review
    // the normal total again instead of confirming an outdated quote.
    setPriceRevision(null)
    setErrorKey(confirmationErrorKey(failure.code))
    if (failure.code === 'seat_unavailable' && failure.availableSeatIds !== null) {
      const stillAvailable = new Set(failure.availableSeatIds)
      setValue('seatIds', getValues('seatIds').filter((id) => stillAvailable.has(id)), {
        shouldValidate: true,
        shouldDirty: true,
      })
      setAtSeatLimit(false)
    }
  }

  function send(values: CheckoutFormOutput, quotedUnitPricePiastres: number) {
    clearOutcome()
    confirm(toCheckoutRequest(showtimeId, values, quotedUnitPricePiastres), {
      onSuccess,
      onError,
    })
  }

  const submit = handleSubmit((values) => send(values, displayedPricePiastres))
  const confirmRevisedTotal = handleSubmit((values) => send(values, priceRevision!))

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

        {confirmed ? (
          <BookingConfirmation booking={confirmed} />
        ) : (
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
                  <p>{t('unitPrice', { price: formatEgp(displayedPricePiastres, locale) })}</p>
                  <p aria-live="polite" className="font-medium">
                    {t('totalPrice', {
                      seatCount: seatIds.length,
                      total: formatEgp(totalPiastres, locale),
                    })}
                  </p>
                </div>

                {priceRevision !== null && (
                  <div className="flex flex-col gap-2 text-sm">
                    <p role="alert" className="text-destructive font-medium">
                      {t('priceChanged', {
                        price: formatEgp(priceRevision, locale),
                        seatCount: seatIds.length,
                        total: formatEgp(checkoutTotalPiastres(priceRevision, seatIds.length), locale),
                      })}
                    </p>
                    <Button type="button" onClick={confirmRevisedTotal} disabled={isPending}>
                      {t('confirmRevisedTotal')}
                    </Button>
                  </div>
                )}
                {errorKey && (
                  <p role="alert" className="text-destructive text-sm font-medium">
                    {t(errorKey)}
                  </p>
                )}
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={bookingClosed || isPending || priceRevision !== null}>
                {isPending ? t('confirming') : t('confirmSelection')}
              </Button>
            </CardFooter>
          </Card>
        )}
      </form>
    </FormProvider>
  )
}
