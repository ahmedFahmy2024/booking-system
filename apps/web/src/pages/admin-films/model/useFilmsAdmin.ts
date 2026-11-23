import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { saveFilm } from '../api/films'
import { adminFilmsQuery } from '../api/films.queries'
import type { FilmInput } from './film'

export function useFilmsAdmin() {
  const queryClient = useQueryClient()
  const options = adminFilmsQuery()
  const { data } = useSuspenseQuery(options)
  const save = useMutation({
    mutationFn: ({ input, id }: { input: FilmInput; id?: string }) => saveFilm(input, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: options.queryKey }),
  })

  return {
    films: data,
    saveFilm: async (input: FilmInput, id?: string) => {
      await save.mutateAsync({ input, id })
    },
  }
}
