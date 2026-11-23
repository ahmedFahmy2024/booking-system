import { queryOptions } from '@tanstack/react-query'
import { listAuditoriums, listFilms } from './cinema-admin'

export const cinemaAdminKeys = {
  all: ['cinema-admin'] as const,
  films: ['cinema-admin', 'films'] as const,
  auditoriums: ['cinema-admin', 'auditoriums'] as const,
}

export const cinemaAdminQueries = {
  films: () =>
    queryOptions({
      queryKey: cinemaAdminKeys.films,
      queryFn: listFilms,
    }),
  auditoriums: () =>
    queryOptions({
      queryKey: cinemaAdminKeys.auditoriums,
      queryFn: listAuditoriums,
    }),
}
