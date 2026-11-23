import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { saveAuditorium } from '../api/auditoriums'
import { adminAuditoriumsQuery } from '../api/auditoriums.queries'
import type { AuditoriumInput } from './auditorium'

export function useAuditoriumsAdmin() {
  const queryClient = useQueryClient()
  const options = adminAuditoriumsQuery()
  const { data } = useSuspenseQuery(options)
  const save = useMutation({
    mutationFn: ({ input, id }: { input: AuditoriumInput; id?: string }) => saveAuditorium(input, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: options.queryKey }),
  })

  return {
    auditoriums: data,
    saveAuditorium: async (input: AuditoriumInput, id?: string) => {
      await save.mutateAsync({ input, id })
    },
  }
}
