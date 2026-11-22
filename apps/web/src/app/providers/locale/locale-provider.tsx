import { DirectionProvider } from '@/shared/ui/direction'
import { useLayoutEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type LocaleProviderProps = {
  children: ReactNode
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const { i18n, t } = useTranslation('common')
  const locale = i18n.resolvedLanguage ?? i18n.language
  const direction = i18n.dir(locale)
  const title = t('appTitle')

  // Base UI's DirectionProvider only sets React context — the DOM attributes
  // (used by CSS, the browser and assistive tech) must be set explicitly.
  useLayoutEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = direction
    document.title = title
  }, [locale, direction, title])

  return <DirectionProvider direction={direction}>{children}</DirectionProvider>
}
