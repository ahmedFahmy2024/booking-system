import { request } from '@/shared/api'
import type { FilmWithShowtimes } from '../model/catalogue'

export function listFilms(): Promise<FilmWithShowtimes[]> {
  return request<FilmWithShowtimes[]>('/films')
}
