export const LOCALES = ['ar-EG', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export type TextDirection = 'ltr' | 'rtl'

export const DEFAULT_LOCALE: Locale = 'ar-EG'
const LOCALE_STORAGE_KEY = 'app-locale'

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'ar-EG' || value === 'en'
}

export function detectInitialLocale(): Locale {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function persistLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // The selected locale still applies for this session when storage is blocked.
  }
}
