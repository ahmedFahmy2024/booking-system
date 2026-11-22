import { fireEvent, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { useLocale } from './locale-context'
import { LocaleProvider } from './locale-provider'

function LocaleProbe() {
  const { locale, direction, setLocale } = useLocale()

  const { t } = useTranslation('bookings')
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="direction">{direction}</span>
      <span>{t('newBooking')}</span>
      <button type="button" onClick={() => setLocale('ar-EG')}>العربية</button>
      <button type="button" onClick={() => setLocale('en')}>English</button>
    </div>
  )
}

describe('LocaleProvider', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  })

  it('starts with Arabic and restores a saved English preference', () => {
    const { unmount } = render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('direction').textContent).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar-EG')
    expect(document.documentElement.dir).toBe('rtl')

    expect(screen.getByText('حجز جديد')).toBeDefined()
    unmount()
    localStorage.setItem('app-locale', 'en')

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('direction').textContent).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('updates translations, direction, and DOM attributes together', async () => {
    render(
      <LocaleProvider defaultLocale="en">
        <LocaleProbe />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('direction').textContent).toBe('ltr')
    expect(document.documentElement.dir).toBe('ltr')

    fireEvent.click(screen.getByRole('button', { name: 'العربية' }))
    expect(await screen.findByText('حجز جديد')).toBeDefined()

    expect(screen.getByTestId('locale').textContent).toBe('ar-EG')
    expect(screen.getByTestId('direction').textContent).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar-EG')
    expect(document.documentElement.dir).toBe('rtl')

    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByText('New booking')).toBeDefined()

    expect(screen.getByTestId('locale').textContent).toBe('en')
    expect(screen.getByTestId('direction').textContent).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })
})
