import { zValidator } from '@hono/zod-validator'
import { and, asc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../auth/middleware.js'
import { requireAdmin } from '../../auth/middleware.js'
import {
  auditoriums,
  films,
  seats,
  showtimes,
  type AuditoriumLayoutSnapshot,
} from '../../db/cinema-schema.js'
import { getDb } from '../../db/index.js'
import { cairoWallClockToInstant, occupancyOf } from './schedule.js'

/**
 * Admin catalogue scheduling (D3). Every route is guarded by `requireAdmin`:
 * the permission matrix grants showtime creation, pricing and publishing to
 * admins only, and denial is decided before any database work.
 */
export const showtimeAdminRoutes = new Hono<AuthEnv>()

const idSchema = z.object({ id: z.uuid() })

const cairoWallClockSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'cairo_wall_clock_format')

export const createShowtimeSchema = z.object({
  filmId: z.uuid(),
  auditoriumId: z.uuid(),
  /** Cairo wall clock `YYYY-MM-DDTHH:mm`, resolved with the DST-aware helper. */
  startsAt: cairoWallClockSchema,
  /** A draft may be unpriced; publishing requires a positive price. */
  pricePiastres: z.number().int().nonnegative().optional(),
})

export const publishShowtimeSchema = z.object({
  pricePiastres: z.number().int().positive(),
})

export const priceShowtimeSchema = publishShowtimeSchema

const parseCairoWallClock = (value: string): Date | null => {
  const [date, time] = value.split('T')
  try {
    return cairoWallClockToInstant({ date, time })
  } catch (error) {
    // A spring-forward gap has no valid instant; reject it as a bad request.
    if (error instanceof RangeError) return null
    throw error
  }
}

/** Drizzle wraps the Neon driver error, so walk the cause chain for the SQLSTATE. */
function isExclusionViolation(error: unknown): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if ((current as Error & { code?: unknown }).code === '23P01') return true
    current = current.cause
  }
  return false
}

function showtimeView(row: typeof showtimes.$inferSelect) {
  return {
    id: row.id,
    filmId: row.filmId,
    auditoriumId: row.auditoriumId,
    startsAt: row.startsAt.toISOString(),
    occupancyEndsAt: row.occupancyEndsAt.toISOString(),
    status: row.status,
    pricePiastres: row.pricePiastres,
    layoutSnapshot: row.layoutSnapshot,
  }
}

showtimeAdminRoutes.get('/', requireAdmin, async (c) => {
  const rows = await getDb()
    .select()
    .from(showtimes)
    .orderBy(asc(showtimes.startsAt))

  return c.json(rows.map(showtimeView))
})

showtimeAdminRoutes.post('/', requireAdmin, zValidator('json', createShowtimeSchema), async (c) => {
  const input = c.req.valid('json')
  const startsAt = parseCairoWallClock(input.startsAt)
  if (!startsAt) return c.json({ error: 'invalid_cairo_wall_clock' }, 400)

  const db = getDb()
  const [film] = await db
    .select({ durationMinutes: films.durationMinutes })
    .from(films)
    .where(eq(films.id, input.filmId))
    .limit(1)
  if (!film) return c.json({ error: 'film_not_found' }, 404)

  const [auditorium] = await db
    .select({ id: auditoriums.id })
    .from(auditoriums)
    .where(eq(auditoriums.id, input.auditoriumId))
    .limit(1)
  if (!auditorium) return c.json({ error: 'auditorium_not_found' }, 404)

  // Pure helper from B3.1: the stored occupancy end drives the DB constraint.
  const occupancy = occupancyOf({ startsAt, durationMinutes: film.durationMinutes })

  let created: typeof showtimes.$inferSelect[] = []
  try {
    created = await db
      .insert(showtimes)
      .values({
        filmId: input.filmId,
        auditoriumId: input.auditoriumId,
        startsAt,
        occupancyEndsAt: occupancy.endsAt,
        pricePiastres: input.pricePiastres ?? 0,
      })
      .returning()
  } catch (error) {
    if (isExclusionViolation(error)) return c.json({ error: 'showtime_overlap' }, 409)
    throw error
  }

  return c.json(showtimeView(created[0]), 201)
})

showtimeAdminRoutes.post(
  '/:id/publish',
  requireAdmin,
  zValidator('param', idSchema),
  zValidator('json', publishShowtimeSchema),
  async (c) => {
    const id = c.req.valid('param').id
    const { pricePiastres } = c.req.valid('json')
    const db = getDb()

    const [current] = await db.select().from(showtimes).where(eq(showtimes.id, id)).limit(1)
    if (!current) return c.json({ error: 'showtime_not_found' }, 404)
    // B3.3 owns only draft -> published; cancellation is B5.4.
    if (current.status !== 'draft') return c.json({ error: 'invalid_status_transition' }, 409)

    const [film] = await db
      .select({ durationMinutes: films.durationMinutes })
      .from(films)
      .where(eq(films.id, current.filmId))
      .limit(1)
    if (!film) return c.json({ error: 'film_not_found' }, 404)

    const [auditorium] = await db
      .select({ id: auditoriums.id, name: auditoriums.name })
      .from(auditoriums)
      .where(eq(auditoriums.id, current.auditoriumId))
      .limit(1)
    if (!auditorium) return c.json({ error: 'auditorium_not_found' }, 404)

    const seatRows = await db
      .select({
        id: seats.id,
        rowLabel: seats.rowLabel,
        seatNumber: seats.seatNumber,
        aisleAfter: seats.aisleAfter,
        isOutOfService: seats.isOutOfService,
      })
      .from(seats)
      .where(eq(seats.auditoriumId, current.auditoriumId))
      .orderBy(asc(seats.rowLabel), asc(seats.seatNumber))
    if (seatRows.length === 0) return c.json({ error: 'auditorium_has_no_seats' }, 409)

    const occupancy = occupancyOf({ startsAt: current.startsAt, durationMinutes: film.durationMinutes })
    const layoutSnapshot: AuditoriumLayoutSnapshot = {
      auditoriumId: auditorium.id,
      auditoriumName: auditorium.name,
      seats: seatRows.map((seat) => ({
        id: seat.id,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        aisleAfter: seat.aisleAfter,
        outOfService: seat.isOutOfService,
      })),
    }

    let updated: typeof showtimes.$inferSelect[] = []
    try {
      updated = await db
        .update(showtimes)
        .set({
          status: 'published',
          pricePiastres,
          layoutSnapshot,
          // Recomputed from the film's current duration at publish time.
          occupancyEndsAt: occupancy.endsAt,
        })
        // A competing publish of the same draft wins once; the loser sees 0 rows.
        .where(and(eq(showtimes.id, id), eq(showtimes.status, 'draft')))
        .returning()
    } catch (error) {
      if (isExclusionViolation(error)) return c.json({ error: 'showtime_overlap' }, 409)
      throw error
    }
    if (updated.length === 0) return c.json({ error: 'invalid_status_transition' }, 409)

    return c.json(showtimeView(updated[0]))
  },
)

showtimeAdminRoutes.patch(
  '/:id/price',
  requireAdmin,
  zValidator('param', idSchema),
  zValidator('json', priceShowtimeSchema),
  async (c) => {
    const id = c.req.valid('param').id
    const { pricePiastres } = c.req.valid('json')
    const db = getDb()

    const updated = await db
      .update(showtimes)
      .set({ pricePiastres })
      .where(and(eq(showtimes.id, id), ne(showtimes.status, 'cancelled')))
      .returning()
    if (updated.length > 0) return c.json(showtimeView(updated[0]))

    const [existing] = await db
      .select({ id: showtimes.id })
      .from(showtimes)
      .where(eq(showtimes.id, id))
      .limit(1)
    if (!existing) return c.json({ error: 'showtime_not_found' }, 404)
    return c.json({ error: 'invalid_status_transition' }, 409)
  },
)
