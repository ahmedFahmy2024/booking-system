import arBookings from './locales/ar-EG/bookings'
import arCatalogue from './locales/ar-EG/catalogue'
import arCinemaAdmin from './locales/ar-EG/cinemaAdmin'
import arCommon from './locales/ar-EG/common'
import arGuestBooking from './locales/ar-EG/guestBooking'
import arStaffBookings from './locales/ar-EG/staffBookings'
import enBookings from './locales/en/bookings'
import enCatalogue from './locales/en/catalogue'
import enCinemaAdmin from './locales/en/cinemaAdmin'
import enCommon from './locales/en/common'
import enGuestBooking from './locales/en/guestBooking'
import enStaffBookings from './locales/en/staffBookings'

export const defaultNamespace = 'common'

export const messages = {
  'ar-EG': {
    common: arCommon,
    bookings: arBookings,
    catalogue: arCatalogue,
    cinemaAdmin: arCinemaAdmin,
    guestBooking: arGuestBooking,
    staffBookings: arStaffBookings,
  },
  en: {
    common: enCommon,
    bookings: enBookings,
    catalogue: enCatalogue,
    cinemaAdmin: enCinemaAdmin,
    guestBooking: enGuestBooking,
    staffBookings: enStaffBookings,
  },
} as const
