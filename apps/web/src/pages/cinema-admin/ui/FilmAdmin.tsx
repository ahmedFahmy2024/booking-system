import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'
import {
  emptyFilmFormValues,
  filmFormSchema,
  toFilmFormValues,
  type Film,
  type FilmFormOutput,
  type FilmFormValues,
} from '../model/cinema'
import { useFilmsAdmin } from '../model/useCinemaAdmin'

export function FilmAdmin() {
  const { t } = useTranslation('cinemaAdmin')
  const { films, saveFilm } = useFilmsAdmin()
  const [editingId, setEditingId] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FilmFormValues, unknown, FilmFormOutput>({
    resolver: zodResolver(filmFormSchema),
    defaultValues: emptyFilmFormValues(),
  })

  // Reset after the submit transition commits, not inside the handler.
  useEffect(() => {
    if (isSubmitSuccessful) reset(emptyFilmFormValues())
  }, [isSubmitSuccessful, reset])

  const submit = handleSubmit(async (values) => {
    clearErrors('root.serverError')
    try {
      await saveFilm(values, editingId ?? undefined)
      setEditingId(null)
    } catch {
      setError('root.serverError', { type: 'server' })
    }
  })

  function startEdit(film: Film) {
    setEditingId(film.id)
    reset(toFilmFormValues(film))
  }

  return (
    <div className="grid gap-6 min-[701px]:grid-cols-[minmax(280px,1fr)_minmax(280px,1.1fr)]">
      <form onSubmit={submit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t('editFilm') : t('newFilm')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.title)}>
                <FieldLabel htmlFor="film-title">{t('filmTitle')}</FieldLabel>
                <Input
                  id="film-title"
                  dir="auto"
                  aria-invalid={Boolean(errors.title)}
                  {...register('title')}
                />
                {errors.title && <FieldError>{t('requiredTitle')}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.durationMinutes)}>
                <FieldLabel htmlFor="film-duration">{t('duration')}</FieldLabel>
                <Input
                  id="film-duration"
                  type="number"
                  min="1"
                  dir="ltr"
                  aria-invalid={Boolean(errors.durationMinutes)}
                  {...register('durationMinutes')}
                />
                {errors.durationMinutes && <FieldError>{t('requiredDuration')}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.synopsis)}>
                <FieldLabel htmlFor="film-synopsis">{t('synopsis')}</FieldLabel>
                <Input
                  id="film-synopsis"
                  dir="auto"
                  aria-invalid={Boolean(errors.synopsis)}
                  {...register('synopsis')}
                />
                {errors.synopsis && <FieldError>{t('requiredSynopsis')}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.posterUrl)}>
                <FieldLabel htmlFor="film-poster">{t('posterUrl')}</FieldLabel>
                <Input
                  id="film-poster"
                  type="url"
                  dir="ltr"
                  aria-invalid={Boolean(errors.posterUrl)}
                  {...register('posterUrl')}
                />
                {errors.posterUrl && <FieldError>{t('invalidPosterUrl')}</FieldError>}
              </Field>
            </FieldGroup>

            {errors.root?.serverError && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{t('saveError')}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isSubmitting ? t('saving') : editingId ? t('saveChanges') : t('addFilm')}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null)
                  reset(emptyFilmFormValues())
                }}
              >
                {t('cancelEdit')}
              </Button>
            )}
          </CardFooter>
        </Card>
      </form>

      <section aria-labelledby="film-list-heading" className="flex flex-col gap-3">
        <h2 id="film-list-heading" className="text-lg font-semibold">
          {t('filmsHeading')}
        </h2>
        {films.length === 0 ? (
          <p className="text-muted-foreground">{t('noFilms')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {films.map((film) => (
              <li key={film.id}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle dir="auto">{film.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t('minutes', { count: film.durationMinutes })}</Badge>
                    <span className="text-muted-foreground text-sm" dir="auto">
                      {film.synopsis}
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(film)}>
                      {t('edit')}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
