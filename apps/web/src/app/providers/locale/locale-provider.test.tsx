import { fireEvent, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from './i18n'
import { LocaleProvider } from './locale-provider'

function LocaleProbe() {
  const { i18n, t } = useTranslation('bookings')
  return (
    <div>
      <span>{t('newBooking')}</span>
      <button type="button" onClick={() => void i18n.changeLanguage('ar-EG')}>العربية</button>
      <button type="button" onClick={() => void i18n.changeLanguage('en')}>English</button>
    </div>
  )
}

describe('LocaleProvider', () => {
  afterEach(() => {
    localStorage.removeItem('app-locale')
  })

  it('starts with Arabic when no language is saved', () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    )

    expect(screen.getByText('حجز جديد')).toBeDefined()
    expect(document.documentElement.lang).toBe('ar-EG')
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.title).toBe('حجوزات السينما')
  })

  it('updates translations, direction, and saved language through i18next', async () => {
    await i18n.changeLanguage('en')

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    )

    expect(screen.getByText('New booking')).toBeDefined()
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(localStorage.getItem('app-locale')).toBe('en')

    fireEvent.click(screen.getByRole('button', { name: 'العربية' }))
    expect(await screen.findByText('حجز جديد')).toBeDefined()
    expect(document.documentElement.lang).toBe('ar-EG')
    expect(document.documentElement.dir).toBe('rtl')
    expect(localStorage.getItem('app-locale')).toBe('ar-EG')

    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByText('New booking')).toBeDefined()
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(localStorage.getItem('app-locale')).toBe('en')
  })
})
