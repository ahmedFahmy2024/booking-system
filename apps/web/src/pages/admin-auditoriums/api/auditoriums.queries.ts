import { queryOptions } from '@tanstack/react-query'
import { listAuditoriums } from './auditoriums'

export const adminAuditoriumsQuery = () =>
  queryOptions({
    queryKey: ['cinema-admin', 'auditoriums'] as const,
    queryFn: listAuditoriums,
  })
