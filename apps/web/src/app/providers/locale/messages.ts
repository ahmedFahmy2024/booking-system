import arBookings from './locales/ar-EG/bookings'
import arCinemaAdmin from './locales/ar-EG/cinemaAdmin'
import arCommon from './locales/ar-EG/common'
import enBookings from './locales/en/bookings'
import enCinemaAdmin from './locales/en/cinemaAdmin'
import enCommon from './locales/en/common'

export const defaultNamespace = 'common'

export const messages = {
  'ar-EG': { common: arCommon, bookings: arBookings, cinemaAdmin: arCinemaAdmin },
  en: { common: enCommon, bookings: enBookings, cinemaAdmin: enCinemaAdmin },
} as const
