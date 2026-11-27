import { request } from '@/shared/api'
import { guestBookingDetailSchema, type GuestBookingDetail } from '../model/guest-booking'

/** The credential is sent only to the owning guest API, never to another origin. */
export function getGuestBooking(reference: string, token: string): Promise<GuestBookingDetail> {
  const query = new URLSearchParams({ token })
  return request<unknown>(`/guest/bookings/${encodeURIComponent(reference)}?${query}`, {
    // The route head commits after the loader starts; this covers the very
    // first request so no proxy or access log can capture a Referer with it.
    referrerPolicy: 'no-referrer',
  }).then((body) => guestBookingDetailSchema.parse(body))
}

/**
 * An explicit write, not a link click: D2 keeps the read-only page safe from
 * crawlers and requires a deliberate confirmation before seats are released.
 * The credential goes in a header so no URL, history entry or Referer holds it.
 */
export function cancelGuestBooking(reference: string, token: string): Promise<GuestBookingDetail> {
  return request<unknown>(`/guest/bookings/${encodeURIComponent(reference)}/cancel`, {
    method: 'POST',
    headers: { 'x-guest-token': token },
    referrerPolicy: 'no-referrer',
  }).then((body) => guestBookingDetailSchema.parse(body))
}
