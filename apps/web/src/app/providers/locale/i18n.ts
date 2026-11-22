import { createInstance } from 'i18next'
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locale'
import { defaultNamespace, messages } from './messages'

export function createAppI18n(locale: Locale) {
  const instance = createInstance()
  void instance.init({
    resources: messages,
    lng: locale,
    supportedLngs: [...LOCALES],
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: defaultNamespace,
    ns: Object.keys(messages[DEFAULT_LOCALE]),
    // All first-render messages are bundled locally.
    initAsync: false,
    interpolation: { escapeValue: false },
  })
  return instance
}
