import { request } from '@/shared/api'
import type { Auditorium, AuditoriumInput } from '../model/auditorium'

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
