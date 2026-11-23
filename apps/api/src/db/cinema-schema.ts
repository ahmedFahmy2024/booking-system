import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/** Immutable value set for the showtime lifecycle; kept in TypeScript, not pgEnum. */
export const SHOWTIME_STATUSES = ['draft', 'published', 'cancelled'] as const
export type ShowtimeStatus = (typeof SHOWTIME_STATUSES)[number]

/**
 * What a published showtime froze about its auditorium. Seat labels, aisle
 * gaps and out-of-service flags are copied at publish time so later auditorium
 * edits cannot rewrite the seat map shown on an existing booking's history.
 */
export interface AuditoriumLayoutSnapshot {
  auditoriumId: string
  auditoriumName: string
  seats: Array<{
    id: string
    rowLabel: string
    seatNumber: number
    aisleAfter: boolean
    outOfService: boolean
  }>
}

export const films = pgTable(
  'films',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    /** Running time used with the 15-minute turnaround to compute occupancy. */
    durationMinutes: integer('duration_minutes').notNull(),
    synopsis: text('synopsis').notNull(),
    posterUrl: text('poster_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [check('films_duration_minutes_positive', sql`${t.durationMinutes} > 0`)],
)

export const auditoriums = pgTable(
  'auditoriums',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [uniqueIndex('auditoriums_name_unique').on(t.name)],
)

export const seats = pgTable(
  'seats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    auditoriumId: uuid('auditorium_id')
      .notNull()
      .references(() => auditoriums.id, { onDelete: 'cascade' }),
    /** Row label shown on the map, for example "A" or "B". */
    rowLabel: text('row_label').notNull(),
    seatNumber: integer('seat_number').notNull(),
    /** Aisle gap after this seat in its row; the last seat has no gap. */
    aisleAfter: boolean('aisle_after').notNull().default(false),
    isOutOfService: boolean('is_out_of_service').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [
    uniqueIndex('seats_auditorium_row_number_unique').on(t.auditoriumId, t.rowLabel, t.seatNumber),
    index('seats_auditorium_id_idx').on(t.auditoriumId),
    check('seats_seat_number_positive', sql`${t.seatNumber} > 0`),
  ],
)

export const showtimes = pgTable(
  'showtimes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filmId: uuid('film_id')
      .notNull()
      .references(() => films.id),
    auditoriumId: uuid('auditorium_id')
      .notNull()
      .references(() => auditoriums.id),
    /** Entered in Africa/Cairo wall-clock time, persisted as a UTC instant. */
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    status: text('status').$type<ShowtimeStatus>().notNull().default('draft'),
    /** Unit price per seat in integer piastres; B3.3 validates before publish. */
    pricePiastres: integer('price_piastres').notNull().default(0),
    /** Written once on publish; NULL while the showtime is still a draft. */
    layoutSnapshot: jsonb('layout_snapshot').$type<AuditoriumLayoutSnapshot>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [
    index('showtimes_film_starts_at_idx').on(t.filmId, t.startsAt),
    index('showtimes_auditorium_starts_at_idx').on(t.auditoriumId, t.startsAt),
    index('showtimes_status_idx').on(t.status),
    check('showtimes_price_piastres_non_negative', sql`${t.pricePiastres} >= 0`),
  ],
)

export const filmsRelations = relations(films, ({ many }) => ({
  showtimes: many(showtimes),
}))

export const auditoriumsRelations = relations(auditoriums, ({ many }) => ({
  seats: many(seats),
  showtimes: many(showtimes),
}))

export const seatsRelations = relations(seats, ({ one }) => ({
  auditorium: one(auditoriums, {
    fields: [seats.auditoriumId],
    references: [auditoriums.id],
  }),
}))

export const showtimesRelations = relations(showtimes, ({ one }) => ({
  film: one(films, { fields: [showtimes.filmId], references: [films.id] }),
  auditorium: one(auditoriums, {
    fields: [showtimes.auditoriumId],
    references: [auditoriums.id],
  }),
}))
