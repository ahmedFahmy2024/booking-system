export interface ShowtimeSummary {
  id: string
  startsAt: string
  pricePiastres: number
  auditoriumName: string
}

export interface FilmWithShowtimes {
  id: string
  title: string
  durationMinutes: number
  synopsis: string
  posterUrl: string | null
  showtimes: ShowtimeSummary[]
}
