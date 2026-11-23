import { relations, sql } from 'drizzle-orm'
import { index, integer, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { showtimes } from './cinema-schema.js'

export * from './auth-schema.js'
// Cinema tables and their relations live in a focused module but are exported
// here so drizzle-kit and the runtime Drizzle schema see the same single entry.
export * from './cinema-schema.js'

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// B2.4: the reference is a support identifier, not a credential. The column
// default lets ADD COLUMN backfill existing prototype rows with a unique value;
// new bookings also supply an explicit generated reference.
const referenceDefault = sql`'bkg_' || replace(gen_random_uuid()::text, '-', '')`

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: integer('service_id')
    .notNull()
    .references(() => services.id),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /** Opaque identifier a guest quotes to staff; never accepted as a credential. */
  reference: text('reference').notNull().unique().default(referenceDefault),
  /** HMAC of the private guest credential; the credential itself is only emailed. */
  guestLinkVerifier: text('guest_link_verifier'),
  /** AES-256-GCM ciphertext so staff can resend the same unexpired link. */
  guestLinkEncrypted: text('guest_link_encrypted'),
  /** Fixed at issue time to startsAt + 7 days; a resend never extends it. */
  guestLinkExpiresAt: timestamp('guest_link_expires_at', { withTimezone: true }),
  /**
   * B3 adds the cinema showtime link as NULLABLE so prototype rows stay valid;
   * B4 populates it and derives guest-link expiry from showtime.starts_at.
   */
  showtimeId: uuid('showtime_id').references(() => showtimes.id),
}, (t) => [index('bookings_showtime_id_idx').on(t.showtimeId)])

export const bookingsRelations = relations(bookings, ({ one }) => ({
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  showtime: one(showtimes, { fields: [bookings.showtimeId], references: [showtimes.id] }),
}))
