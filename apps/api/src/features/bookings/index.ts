import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../auth/middleware.js'
import { requireStaff } from '../../auth/middleware.js'
import { getDb } from '../../db/index.js'
import { bookings, services } from '../../db/schema.js'
import { rateLimit } from '../../rate-limit.js'
import {
  createBookingReference,
  createGuestCredential,
  decryptGuestCredential,
  encryptGuestCredential,
  guestLinkExpiresAt,
  guestLinkVerifier,
  isGuestLinkExpired,
  verifyGuestLinkVerifier,
} from '../guest/credentials.js'
import { confirmationRoutes } from './confirmation.js'
import { sendGuestLink } from './guest-link.js'

export const bookingsRoutes = new Hono<AuthEnv>()

// B4.2: the cinema confirmation write shares the /bookings prefix with the
// prototype endpoints but uses the shared checkout schema and seat claims.
bookingsRoutes.route('/confirm', confirmationRoutes)

const createBookingSchema = z.object({
  serviceId: z.number().int().positive(),
  customerName: z.string().min(1),
  customerEmail: z.email(),
  startsAt: z.iso.datetime(),
})

// The list is a staff view of every booking. Operations and admin may read it;
// a public visitor has no session, and a guest link holder has no staff session.
bookingsRoutes.get('/', requireStaff, async (c) => {
  const rows = await getDb()
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      startsAt: bookings.startsAt,
      serviceName: services.name,
    })
    .from(bookings)
    // A cinema booking has no prototype service; keep it visible to staff.
    .leftJoin(services, eq(bookings.serviceId, services.id))

  return c.json(rows)
})

bookingsRoutes.post(
  '/',
  rateLimit('checkout', 30),
  zValidator('json', createBookingSchema),
  async (c) => {
    const input = c.req.valid('json')
    const startsAt = new Date(input.startsAt)
    const reference = createBookingReference()
    const credential = createGuestCredential()

    const [created] = await getDb()
      .insert(bookings)
      .values({
        serviceId: input.serviceId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        startsAt,
        reference,
        guestLinkVerifier: guestLinkVerifier(credential),
        guestLinkEncrypted: encryptGuestCredential(credential),
        guestLinkExpiresAt: guestLinkExpiresAt(startsAt),
      })
      // Never return the verifier, ciphertext or credential to the caller.
      .returning({
        id: bookings.id,
        serviceId: bookings.serviceId,
        customerName: bookings.customerName,
        customerEmail: bookings.customerEmail,
        startsAt: bookings.startsAt,
        reference: bookings.reference,
      })

    await sendGuestLink(created.customerEmail, created.reference, credential)
    return c.json(created, 201)
  },
)

// Both operations and admin may resend (permission matrix). The same
// unexpired credential is decrypted and re-emailed; expiry is never rewritten.
bookingsRoutes.post('/:id/guest-link/resend', requireStaff, async (c) => {
  const id = c.req.param('id')
  const [booking] = await getDb()
    .select({
      id: bookings.id,
      customerEmail: bookings.customerEmail,
      reference: bookings.reference,
      startsAt: bookings.startsAt,
      guestLinkVerifier: bookings.guestLinkVerifier,
      guestLinkEncrypted: bookings.guestLinkEncrypted,
      guestLinkExpiresAt: bookings.guestLinkExpiresAt,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1)

  if (!booking) {
    return c.json({ error: 'booking_not_found' }, 404)
  }

  if (booking.guestLinkVerifier && booking.guestLinkEncrypted) {
    if (isGuestLinkExpired(booking.guestLinkExpiresAt)) {
      return c.json({ error: 'guest_link_expired' }, 409)
    }
    let credential: string
    try {
      credential = decryptGuestCredential(booking.guestLinkEncrypted)
    } catch {
      return c.json({ error: 'guest_link_unavailable' }, 500)
    }
    if (!verifyGuestLinkVerifier(booking.guestLinkVerifier, credential)) {
      return c.json({ error: 'guest_link_unavailable' }, 500)
    }
    await sendGuestLink(booking.customerEmail, booking.reference, credential)
    return c.json({ id: booking.id, sent: true })
  }

  // Backfilled prototype rows have no link yet: issue the first one, with an
  // expiry derived once from the showtime-start surrogate. No link means no
  // extension of an existing expiry.
  const expiresAt = guestLinkExpiresAt(booking.startsAt)
  if (isGuestLinkExpired(expiresAt)) {
    return c.json({ error: 'guest_link_expired' }, 409)
  }
  const credential = createGuestCredential()
  await getDb()
    .update(bookings)
    .set({
      guestLinkVerifier: guestLinkVerifier(credential),
      guestLinkEncrypted: encryptGuestCredential(credential),
      guestLinkExpiresAt: expiresAt,
    })
    .where(eq(bookings.id, booking.id))

  await sendGuestLink(booking.customerEmail, booking.reference, credential)
  return c.json({ id: booking.id, sent: true })
})
