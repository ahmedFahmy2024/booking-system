import type { defaultNamespace, messages } from './messages'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNamespace
    resources: (typeof messages)['ar-EG']
  }
}
