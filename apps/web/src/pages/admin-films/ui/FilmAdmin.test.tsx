import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Film } from '../model/film'
import { FilmAdmin } from './FilmAdmin'

const mocks = vi.hoisted(() => ({
  saveFilm: vi.fn(),
}))

vi.mock('../model/useFilmsAdmin', () => ({
  useFilmsAdmin: () => ({ films, saveFilm: mocks.saveFilm }),
}))

const films: Film[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Cairo Nights',
    durationMinutes: 120,
    synopsis: 'A story set in Cairo.',
    posterUrl: null,
  },
]

const saveError = 'تعذر الحفظ. حاول مرة أخرى.'

function fillForm(title = 'New Film') {
  fireEvent.change(screen.getByLabelText('عنوان الفيلم'), { target: { value: title } })
  fireEvent.change(screen.getByLabelText('المدة بالدقائق'), { target: { value: '95' } })
  fireEvent.change(screen.getByLabelText('نبذة عن الفيلم'), { target: { value: 'Synopsis' } })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.saveFilm.mockResolvedValue(undefined)
})

describe('FilmAdmin', () => {
  it('shows validation messages and does not save when empty', async () => {
    render(<FilmAdmin />)

    fireEvent.click(screen.getByRole('button', { name: 'إضافة الفيلم' }))

    expect(await screen.findByText('أدخل عنوان الفيلم')).toBeDefined()
    expect(screen.getByText('أدخل مدة صحيحة بالدقائق')).toBeDefined()
    expect(screen.getByText('أدخل نبذة عن الفيلم')).toBeDefined()
    expect(mocks.saveFilm).not.toHaveBeenCalled()
  })

  it('saves parsed film values and clears the form after success', async () => {
    render(<FilmAdmin />)

    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'إضافة الفيلم' }))

    await waitFor(() => expect(mocks.saveFilm).toHaveBeenCalledTimes(1))
    expect(mocks.saveFilm).toHaveBeenCalledWith(
      {
        title: 'New Film',
        durationMinutes: 95,
        synopsis: 'Synopsis',
        posterUrl: null,
      },
      undefined,
    )
    await waitFor(() =>
      expect(screen.getByLabelText('عنوان الفيلم')).toHaveProperty('value', ''),
    )
  })

  it('loads a saved film for editing and keeps its id on save', async () => {
    render(<FilmAdmin />)

    fireEvent.click(screen.getByRole('button', { name: 'تعديل' }))
    expect(screen.getByLabelText('عنوان الفيلم')).toHaveProperty('value', 'Cairo Nights')

    fireEvent.change(screen.getByLabelText('عنوان الفيلم'), { target: { value: 'Cairo Nights 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }))

    await waitFor(() => expect(mocks.saveFilm).toHaveBeenCalledTimes(1))
    expect(mocks.saveFilm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Cairo Nights 2' }),
      films[0].id,
    )
  })

  it('shows a server error and preserves the entered values', async () => {
    mocks.saveFilm.mockRejectedValueOnce(new Error('forbidden'))

    render(<FilmAdmin />)
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'إضافة الفيلم' }))

    expect(await screen.findByText(saveError)).toBeDefined()
    expect(screen.getByLabelText('عنوان الفيلم')).toHaveProperty('value', 'New Film')
  })
})
