import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { saveAuditorium, saveFilm } from '../api/cinema-admin'
import { cinemaAdminKeys, cinemaAdminQueries } from '../api/cinema-admin.queries'
import type { AuditoriumInput, FilmInput } from './cinema'

function useSaveFilm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: FilmInput; id?: string }) => saveFilm(input, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cinemaAdminKeys.films }),
  })
}

function useSaveAuditorium() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: AuditoriumInput; id?: string }) =>
      saveAuditorium(input, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cinemaAdminKeys.auditoriums }),
  })
}

export function useFilmsAdmin() {
  // The route loader primed this query with staleTime 'static'.
  const query = useSuspenseQuery(cinemaAdminQueries.films())
  const save = useSaveFilm()

  return {
    films: query.data,
    saveFilm: async (input: FilmInput, id?: string) => {
      await save.mutateAsync({ input, id })
    },
  }
}

export function useAuditoriumsAdmin() {
  const query = useSuspenseQuery(cinemaAdminQueries.auditoriums())
  const save = useSaveAuditorium()

  return {
    auditoriums: query.data,
    saveAuditorium: async (input: AuditoriumInput, id?: string) => {
      await save.mutateAsync({ input, id })
    },
  }
}
