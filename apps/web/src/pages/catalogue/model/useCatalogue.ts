import { useSuspenseQuery } from '@tanstack/react-query'
import { catalogueQuery } from '../api/catalogue.queries'

export function useCatalogue() {
  // The route loader primes this query, so the first render reads from cache.
  const { data: films } = useSuspenseQuery(catalogueQuery())
  return { films }
}
