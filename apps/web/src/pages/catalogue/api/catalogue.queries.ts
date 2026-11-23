import { queryOptions } from '@tanstack/react-query'
import { listFilms } from './catalogue'

export const catalogueKeys = {
  all: ['catalogue'] as const,
  films: ['catalogue', 'films'] as const,
}

export const catalogueQuery = () =>
  queryOptions({
    queryKey: catalogueKeys.films,
    queryFn: listFilms,
  })
