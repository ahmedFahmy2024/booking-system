import { relations, sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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

/** B5: cancellation is a status change, never a booking deletion (D5 history). */
export const BOOKING_STATUSES = ['confirmed', 'cancelled'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/**
 * The exact public response a confirmation returned, minus contact details.
 * The guest email stays on the booking row (alongside the legacy customer
 * name), so D7 retention clears it in one record while the rest of the outcome
 * remains available for idempotent replay (D4) and non-contact history.
 */
export interface StoredConfirmationResponse {
  id: string
  reference: string
  showtimeId: string
  filmTitle: string
  startsAt: string
  auditoriumName: string
  seatLabels: string[]
  seatIds: string[]
  unitPricePiastres: number
  totalPiastres: number
}

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Prototype rows keep a service; a cinema booking is scoped by showtime instead. */
  serviceId: integer('service_id').references(() => services.id),
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
  /** Accepted unit price snapshotted at confirmation; NULL on prototype rows. */
  unitPricePiastres: integer('unit_price_piastres'),
  /** Accepted total snapshotted at confirmation; NULL on prototype rows. */
  totalPiastres: integer('total_piastres'),
  /**
   * D5: cancellation changes status, not arrival or venue payment. The default
   * backfills prototype rows as confirmed without rewriting existing data.
   * No CHECK constraint so B6 can add `no_show` without another migration.
   */
  status: text('status').$type<BookingStatus>().notNull().default('confirmed'),
  /** Set when a guest or staff cancellation is accepted; no actor for guests. */
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  /** D4: stable key from the guest's confirmation attempt; NULL on older rows. */
  idempotencyKey: text('idempotency_key'),
  /** SHA-256 of the canonical request; reusing the key with another payload conflicts. */
  idempotencyFingerprint: text('idempotency_fingerprint'),
  /** Original 201 body (without the guest email) replayed after a lost response. */
  idempotencyResponse: jsonb('idempotency_response').$type<StoredConfirmationResponse>(),
}, (t) => [
  index('bookings_showtime_id_idx').on(t.showtimeId),
  uniqueIndex('bookings_idempotency_key_unique').on(t.idempotencyKey),
  check('bookings_unit_price_positive', sql`${t.unitPricePiastres} is null or ${t.unitPricePiastres} > 0`),
  check('bookings_total_positive', sql`${t.totalPiastres} is null or ${t.totalPiastres} > 0`),
])

/**
 * One row per claimed seat. The unique `(showtime_id, seat_id)` index is the
 * Postgres arbiter for competing confirmations: a multi-seat insert is atomic,
 * so a request that loses any seat creates neither the booking nor a partial
 * claim. Seat ids come from the frozen showtime snapshot rather than the live
 * seats table, whose rows may be replaced by a later auditorium edit.
 */
export const bookingSeats = pgTable('booking_seats', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  showtimeId: uuid('showtime_id')
    .notNull()
    .references(() => showtimes.id),
  seatId: uuid('seat_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('booking_seats_showtime_seat_unique').on(t.showtimeId, t.seatId),
  index('booking_seats_booking_id_idx').on(t.bookingId),
])

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  showtime: one(showtimes, { fields: [bookings.showtimeId], references: [showtimes.id] }),
  seats: many(bookingSeats),
}))

export const bookingSeatsRelations = relations(bookingSeats, ({ one }) => ({
  booking: one(bookings, { fields: [bookingSeats.bookingId], references: [bookings.id] }),
  showtime: one(showtimes, { fields: [bookingSeats.showtimeId], references: [showtimes.id] }),
}))
