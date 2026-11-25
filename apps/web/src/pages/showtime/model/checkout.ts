import {
  canonicalCheckoutPayload,
  checkoutConfirmationSchema,
  checkoutRequestSchema,
} from '@booking-system/cinema-contracts'
import { z } from 'zod'

/** The payload the confirmation API accepts, including the reviewed unit price. */
export type CheckoutRequest = z.output<typeof checkoutConfirmationSchema>

/**
 * Public fields returned by the confirmation write; never a guest credential.
 * Display fields come from the server's frozen showtime data so the confirmation
 * stays accurate even if the film or auditorium is edited after booking.
 */
export interface ConfirmedBooking {
  id: string
  reference: string
  showtimeId: string
  filmTitle: string
  startsAt: string
  auditoriumName: string
  seatLabels: string[]
  seatIds: string[]
  customerEmail: string
  unitPricePiastres: number
  totalPiastres: number
}

/**
 * Raw form values use a plain email field name. Validation itself is derived
 * from the shared contract so the form and the API enforce the same rules.
 */
export const checkoutFormSchema = z.object({
  seatIds: checkoutRequestSchema.shape.seatIds,
  email: z.string().trim().pipe(checkoutRequestSchema.shape.customerEmail),
})

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>
export type CheckoutFormOutput = z.output<typeof checkoutFormSchema>

export function emptyCheckoutFormValues(): CheckoutFormValues {
  return { seatIds: [], email: '' }
}

export function toCheckoutRequest(
  showtimeId: string,
  values: CheckoutFormOutput,
  quotedUnitPricePiastres: number,
): CheckoutRequest {
  return checkoutConfirmationSchema.parse({
    showtimeId,
    seatIds: values.seatIds,
    customerEmail: values.email,
    quotedUnitPricePiastres,
  })
}

/** Same canonical form the API fingerprints, so the web rotates its key on a real change. */
export function checkoutPayloadFingerprint(request: CheckoutRequest): string {
  return canonicalCheckoutPayload(request)
}

/** Prices are integer piastres from the showtime detail; the helper only formats. */
export function checkoutTotalPiastres(pricePiastres: number, seatCount: number): number {
  return pricePiastres * seatCount
}
