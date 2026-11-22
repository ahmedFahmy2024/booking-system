import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { defaultNamespace, messages } from './messages'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: messages,
    supportedLngs: Object.keys(messages),
    fallbackLng: 'ar-EG',
    defaultNS: defaultNamespace,
    ns: Object.keys(messages['ar-EG']),
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'app-locale',
      caches: ['localStorage'],
    },
    // All first-render messages are bundled locally.
    initAsync: false,
    interpolation: { escapeValue: false },
  })

export default i18n
