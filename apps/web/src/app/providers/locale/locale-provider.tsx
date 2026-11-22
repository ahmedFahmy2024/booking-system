import { DirectionProvider } from '@/shared/ui/direction'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { createAppI18n } from './i18n'
import { LocaleContext } from './locale-context'
import {
  DEFAULT_LOCALE,
  detectInitialLocale,
  isLocale,
  persistLocale,
  type Locale,
} from './locale'

type LocaleProviderProps = {
  children: ReactNode
  defaultLocale?: Locale
}

export function LocaleProvider({ children, defaultLocale }: LocaleProviderProps) {
  const [instance] = useState(() => createAppI18n(defaultLocale ?? detectInitialLocale()))
  const { i18n, t } = useTranslation('common', { i18n: instance })
  const locale = isLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LOCALE
  const direction = i18n.dir(locale)
  const title = t('appTitle')

  // Base UI's DirectionProvider only sets React context — the DOM attributes
  // (used by CSS, the browser and assistive tech) must be set explicitly.
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = direction
    document.title = title
    persistLocale(locale)
  }, [locale, direction, title])

  const value = useMemo(
    () => ({
      locale,
      direction,
      setLocale: (nextLocale: Locale) => {
        void i18n.changeLanguage(nextLocale)
      },
    }),
    [locale, direction, i18n],
  )

  return (
    <I18nextProvider i18n={instance}>
      <LocaleContext.Provider value={value}>
        <DirectionProvider direction={direction}>{children}</DirectionProvider>
      </LocaleContext.Provider>
    </I18nextProvider>
  )
}
