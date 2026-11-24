import { eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { Hono } from 'hono'
import type { AuthEnv } from '../../auth/middleware.js'
import { getDb } from '../../db/index.js'
import { bookings, services } from '../../db/schema.js'
import { rateLimit } from '../../rate-limit.js'
import { matchesGuestCredential } from './credentials.js'

export const guestRoutes = new Hono<AuthEnv>()

// Generated references are base64url; migrated rows are hex. Both are 32 chars.
const REFERENCE_PATTERN = /^bkg_[A-Za-z0-9_-]{32,64}$/
const GENERIC_DENIAL = { error: 'guest_link_invalid' } as const

// The private credential lives in the URL and the email, never in a cached
// response or a Referer header sent to another origin. Apply on every branch.
const guestHeaders = createMiddleware<AuthEnv>(async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  await next()
  c.res.headers.set('Cache-Control', 'no-store')
  c.res.headers.set('Referrer-Policy', 'no-referrer')
})

guestRoutes.use('*', guestHeaders, rateLimit('guest-link', 20))

function deny(c: Context<AuthEnv>) {
  return c.json(GENERIC_DENIAL, 404)
}

// Read-only by construction: this group exposes no write route. Cancellation
// is a separate, explicit write in B5.
guestRoutes.get('/bookings/:reference', async (c) => {
  const token = c.req.query('token')
  const reference = c.req.param('reference')

  // A reference alone is never a credential. Reject before reading the DB so
  // the denial is identical for a missing, invalid or expired token.
  if (!token || !REFERENCE_PATTERN.test(reference)) return deny(c)

  const [row] = await getDb()
    .select({
      id: bookings.id,
      reference: bookings.reference,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      startsAt: bookings.startsAt,
      serviceName: services.name,
      guestLinkVerifier: bookings.guestLinkVerifier,
      guestLinkExpiresAt: bookings.guestLinkExpiresAt,
    })
    .from(bookings)
    // Cinema bookings have no prototype service; the guest still needs their link.
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.reference, reference))
    .limit(1)

  if (!row || !matchesGuestCredential(row.guestLinkVerifier, row.guestLinkExpiresAt, token)) {
    return deny(c)
  }

  // The verifier and expiry are internal only; never reflect credential data.
  return c.json({
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    startsAt: row.startsAt,
    serviceName: row.serviceName,
  })
})
