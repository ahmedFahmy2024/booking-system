import { describe, expect, it } from 'vitest'
import { filmFormSchema } from './film'

describe('film form model', () => {
  it('parses the film form into API-shaped values', () => {
    const parsed = filmFormSchema.parse({
      title: 'Cairo Nights',
      durationMinutes: '120',
      synopsis: 'A story.',
      posterUrl: '',
    })
    expect(parsed.durationMinutes).toBe(120)
    expect(parsed.posterUrl).toBeNull()
    expect(filmFormSchema.safeParse({ ...parsed, durationMinutes: '0' }).success).toBe(false)
    expect(
      filmFormSchema.safeParse({ ...parsed, posterUrl: 'not-a-url' }).success,
    ).toBe(false)
  })
})
