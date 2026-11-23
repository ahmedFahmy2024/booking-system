import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertDescription,
  Badge,
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
  Spinner,
} from '@/shared/ui'
import {
  auditoriumFormSchema,
  emptyAuditoriumFormValues,
  toAuditoriumFormValues,
  toAuditoriumInput,
  type Auditorium,
  type AuditoriumFormOutput,
  type AuditoriumFormValues,
} from '../model/auditorium'
import { useAuditoriumsAdmin } from '../model/useAuditoriumsAdmin'
import { SeatMapEditor } from './SeatMapEditor'

export function AuditoriumAdmin() {
  const { t } = useTranslation('cinemaAdmin')
  const { auditoriums, saveAuditorium } = useAuditoriumsAdmin()
  const [editingId, setEditingId] = useState<string | null>(null)
  const form = useForm<AuditoriumFormValues, unknown, AuditoriumFormOutput>({
    resolver: zodResolver(auditoriumFormSchema),
    defaultValues: emptyAuditoriumFormValues(),
  })
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = form

  useEffect(() => {
    if (isSubmitSuccessful) reset(emptyAuditoriumFormValues())
  }, [isSubmitSuccessful, reset])

  const submit = handleSubmit(async (values) => {
    clearErrors('root.serverError')
    try {
      await saveAuditorium(toAuditoriumInput(values), editingId ?? undefined)
      setEditingId(null)
    } catch {
      setError('root.serverError', { type: 'server' })
    }
  })

  function startEdit(auditorium: Auditorium) {
    setEditingId(auditorium.id)
    reset(toAuditoriumFormValues(auditorium))
  }

  return (
    <div className="grid gap-6 min-[701px]:grid-cols-[minmax(300px,1.2fr)_minmax(260px,0.8fr)]">
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate>
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? t('editAuditorium') : t('newAuditorium')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <FieldGroup>
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="auditorium-name">{t('auditoriumName')}</FieldLabel>
                  <Input
                    id="auditorium-name"
                    dir="auto"
                    aria-invalid={Boolean(errors.name)}
                    {...register('name')}
                  />
                  {errors.name && <FieldError>{t('requiredName')}</FieldError>}
                </Field>
              </FieldGroup>
              <SeatMapEditor />
              {errors.root?.serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{t('saveError')}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                {isSubmitting ? t('saving') : editingId ? t('saveChanges') : t('addAuditorium')}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null)
                    reset(emptyAuditoriumFormValues())
                  }}
                >
                  {t('cancelEdit')}
                </Button>
              )}
            </CardFooter>
          </Card>
        </form>
      </FormProvider>

      <section aria-labelledby="auditorium-list-heading" className="flex flex-col gap-3">
        <h2 id="auditorium-list-heading" className="text-lg font-semibold">
          {t('auditoriumsHeading')}
        </h2>
        {auditoriums.length === 0 ? (
          <p className="text-muted-foreground">{t('noAuditoriums')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {auditoriums.map((auditorium) => {
              const unavailable = auditorium.seats.filter((seat) => seat.isOutOfService).length
              return (
                <li key={auditorium.id}>
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle dir="auto">{auditorium.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {t('seatCount', { count: auditorium.seats.length })}
                      </Badge>
                      {unavailable > 0 && (
                        <Badge variant="outline">
                          {t('outOfServiceCount', { count: unavailable })}
                        </Badge>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(auditorium)}
                      >
                        {t('edit')}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
