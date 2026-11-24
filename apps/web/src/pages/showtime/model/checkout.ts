import { checkoutRequestSchema } from '@booking-system/cinema-contracts'
import { z } from 'zod'

/** The payload the confirmation API accepts. */
export type CheckoutRequest = z.output<typeof checkoutRequestSchema>

/** Public fields returned by the confirmation write; never a guest credential. */
export interface ConfirmedBooking {
  id: string
  reference: string
  showtimeId: string
  seatIds: string[]
  customerEmail: string
  startsAt: string
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
): CheckoutRequest {
  return checkoutRequestSchema.parse({
    showtimeId,
    seatIds: values.seatIds,
    customerEmail: values.email,
  })
}

/** Prices are integer piastres from the showtime detail; the helper only formats. */
export function checkoutTotalPiastres(pricePiastres: number, seatCount: number): number {
  return pricePiastres * seatCount
}
