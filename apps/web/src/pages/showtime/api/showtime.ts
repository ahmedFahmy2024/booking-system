import { request } from '@/shared/api'
import type { SeatMap, ShowtimeDetail } from '../model/showtime'

export function getShowtime(id: string): Promise<ShowtimeDetail> {
  return request<ShowtimeDetail>(`/showtimes/${encodeURIComponent(id)}`)
}

export function getSeatMap(id: string): Promise<SeatMap> {
  return request<SeatMap>(`/showtimes/${encodeURIComponent(id)}/seat-map`)
}
