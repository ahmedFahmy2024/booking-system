import { createContext, useContext } from 'react'
import type { Locale, TextDirection } from './locale'

export type LocaleContextValue = {
  locale: Locale
  direction: TextDirection
  setLocale: (locale: Locale) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return context
}
