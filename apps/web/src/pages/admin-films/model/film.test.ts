import { describe, expect, it } from 'vitest'
import { filmFormSchema } from './film'

describe('film form model', () => {
  it('parses the film form into API-shaped values', () => {
    const formValues = {
      title: 'Cairo Nights',
      durationMinutes: '120',
      synopsis: 'A story.',
      posterUrl: '',
    }
    const parsed = filmFormSchema.parse(formValues)
    expect(parsed.durationMinutes).toBe(120)
    expect(parsed.posterUrl).toBeNull()
    const blankDuration = filmFormSchema.safeParse({ ...formValues, durationMinutes: '  ' })
    expect(blankDuration.error?.issues).toContainEqual(expect.objectContaining({
      code: 'too_small',
      origin: 'string',
      path: ['durationMinutes'],
    }))
    expect(filmFormSchema.safeParse({ ...formValues, durationMinutes: '0' }).success).toBe(false)
    expect(
      filmFormSchema.safeParse({ ...formValues, posterUrl: 'not-a-url' }).success,
    ).toBe(false)
  })
})
