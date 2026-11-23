import { request } from '@/shared/api'
import type { Film, FilmInput } from '../model/film'

export function listFilms(): Promise<Film[]> {
  return request<Film[]>('/admin/films')
}

export function saveFilm(input: FilmInput, id?: string): Promise<Film> {
  return id
    ? request<Film>(`/admin/films/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
    : request<Film>('/admin/films', { method: 'POST', body: JSON.stringify(input) })
}
