import arBookings from './locales/ar-EG/bookings'
import arCommon from './locales/ar-EG/common'
import enBookings from './locales/en/bookings'
import enCommon from './locales/en/common'

export const defaultNamespace = 'common'

export const messages = {
  'ar-EG': { common: arCommon, bookings: arBookings },
  en: { common: enCommon, bookings: enBookings },
} as const
