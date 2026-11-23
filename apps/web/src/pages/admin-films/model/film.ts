import { filmWriteSchema } from '@booking-system/cinema-contracts'
import { z } from 'zod'

export interface Film {
  id: string
  title: string
  durationMinutes: number
  synopsis: string
  posterUrl: string | null
}

export type FilmInput = z.output<typeof filmWriteSchema>

export const filmFormSchema = filmWriteSchema.extend({
  durationMinutes: z.string().trim().min(1).transform(Number).pipe(filmWriteSchema.shape.durationMinutes),
})

export type FilmFormValues = z.input<typeof filmFormSchema>
export type FilmFormOutput = FilmInput

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
