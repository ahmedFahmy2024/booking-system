import { integer, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export * from './auth-schema.js'

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: integer('service_id')
    .notNull()
    .references(() => services.id),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
