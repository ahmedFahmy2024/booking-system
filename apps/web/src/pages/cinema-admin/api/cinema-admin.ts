import type { Auditorium, AuditoriumInput, Film, FilmInput } from '../model/cinema'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; message?: string }
    if (typeof body.error === 'string') return body.error
    if (body.message) return body.message
  } catch {
    // Non-JSON error response — fall back to the status code.
  }
  return `Request failed (${response.status})`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })

  if (!response.ok) throw new Error(await readError(response))

  return response.json() as Promise<T>
}

export function listFilms(): Promise<Film[]> {
  return request<Film[]>('/admin/films')
}

export function saveFilm(input: FilmInput, id?: string): Promise<Film> {
  return id
    ? request<Film>(`/admin/films/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
    : request<Film>('/admin/films', { method: 'POST', body: JSON.stringify(input) })
}

export function listAuditoriums(): Promise<Auditorium[]> {
  return request<Auditorium[]>('/admin/auditoriums')
}

export function saveAuditorium(input: AuditoriumInput, id?: string): Promise<Auditorium> {
  return id
    ? request<Auditorium>(`/admin/auditoriums/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      })
    : request<Auditorium>('/admin/auditoriums', {
        method: 'POST',
        body: JSON.stringify(input),
      })
}
