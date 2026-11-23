import { z } from 'zod'

export interface Film {
  id: string
  title: string
  durationMinutes: number
  synopsis: string
  posterUrl: string | null
}

export interface FilmInput {
  title: string
  durationMinutes: number
  synopsis: string
  posterUrl: string | null
}

// The form keeps duration as a string until validation returns the API payload.
export const filmFormSchema = z.object({
  title: z.string().trim().min(1),
  durationMinutes: z.string().trim().min(1).transform(Number).pipe(z.number().int().positive()),
  synopsis: z.string().trim().min(1),
  posterUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.url().nullable()),
})

export type FilmFormValues = z.input<typeof filmFormSchema>
export type FilmFormOutput = z.output<typeof filmFormSchema>

export function toFilmFormValues(film: Film): FilmFormValues {
  return {
    title: film.title,
    durationMinutes: String(film.durationMinutes),
    synopsis: film.synopsis,
    posterUrl: film.posterUrl ?? '',
  }
}

export function emptyFilmFormValues(): FilmFormValues {
  return { title: '', durationMinutes: '', synopsis: '', posterUrl: '' }
}
