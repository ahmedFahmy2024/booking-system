import { queryOptions } from '@tanstack/react-query'
import { listFilms } from './films'

export const adminFilmsQuery = () =>
  queryOptions({
    queryKey: ['cinema-admin', 'films'] as const,
    queryFn: listFilms,
  })
