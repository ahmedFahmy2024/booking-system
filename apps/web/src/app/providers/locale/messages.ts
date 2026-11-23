import arBookings from './locales/ar-EG/bookings'
import arCatalogue from './locales/ar-EG/catalogue'
import arCinemaAdmin from './locales/ar-EG/cinemaAdmin'
import arCommon from './locales/ar-EG/common'
import enBookings from './locales/en/bookings'
import enCatalogue from './locales/en/catalogue'
import enCinemaAdmin from './locales/en/cinemaAdmin'
import enCommon from './locales/en/common'

export const defaultNamespace = 'common'

export const messages = {
  'ar-EG': {
    common: arCommon,
    bookings: arBookings,
    catalogue: arCatalogue,
    cinemaAdmin: arCinemaAdmin,
  },
  en: {
    common: enCommon,
    bookings: enBookings,
    catalogue: enCatalogue,
    cinemaAdmin: enCinemaAdmin,
  },
} as const
