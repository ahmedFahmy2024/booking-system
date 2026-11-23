import { auditoriumWriteSchema, filmWriteSchema } from '@booking-system/cinema-contracts'
import { zValidator } from '@hono/zod-validator'
import { randomUUID } from 'node:crypto'
import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../auth/middleware.js'
import { requireAdmin } from '../../auth/middleware.js'
import { auditoriums, films, seats } from '../../db/cinema-schema.js'
import { getDb } from '../../db/index.js'

/**
 * Admin-only catalogue configuration. Every route is guarded by `requireAdmin`:
 * the permission matrix grants film and seat-map writes to admins only, and
 * denial is decided on the server before any database work.
 */
export const cinemaAdminRoutes = new Hono<AuthEnv>()

const idSchema = z.object({ id: z.uuid() })

type FilmViewRow = Pick<
  typeof films.$inferSelect,
  'id' | 'title' | 'durationMinutes' | 'synopsis' | 'posterUrl'
>
type AuditoriumViewRow = Pick<typeof auditoriums.$inferSelect, 'id' | 'name'>
type SeatViewRow = Pick<
  typeof seats.$inferSelect,
  'id' | 'rowLabel' | 'seatNumber' | 'aisleAfter' | 'isOutOfService'
>
type SeatWithAuditorium = SeatViewRow & Pick<typeof seats.$inferSelect, 'auditoriumId'>

function filmView(row: FilmViewRow) {
  return {
    id: row.id,
    title: row.title,
    durationMinutes: row.durationMinutes,
    synopsis: row.synopsis,
    posterUrl: row.posterUrl,
  }
}

function seatView(row: SeatViewRow) {
  return {
    id: row.id,
    rowLabel: row.rowLabel,
    seatNumber: row.seatNumber,
    aisleAfter: row.aisleAfter,
    isOutOfService: row.isOutOfService,
  }
}

function auditoriumView(row: AuditoriumViewRow, seatRows: SeatViewRow[]) {
  return { id: row.id, name: row.name, seats: seatRows.map(seatView) }
}

const seatColumns = {
  id: seats.id,
  auditoriumId: seats.auditoriumId,
  rowLabel: seats.rowLabel,
  seatNumber: seats.seatNumber,
  aisleAfter: seats.aisleAfter,
  isOutOfService: seats.isOutOfService,
}

const orderedSeats = (db: ReturnType<typeof getDb>, auditoriumIds: string[]) =>
  db
    .select(seatColumns)
    .from(seats)
    .where(inArray(seats.auditoriumId, auditoriumIds))
    .orderBy(asc(seats.rowLabel), asc(seats.seatNumber))

const seatsFor = (db: ReturnType<typeof getDb>, auditoriumId: string) =>
  db
    .select(seatColumns)
    .from(seats)
    .where(eq(seats.auditoriumId, auditoriumId))
    .orderBy(asc(seats.rowLabel), asc(seats.seatNumber))

// The neon-http driver throws on interactive transactions, but it does expose
// a non-interactive transaction through db.batch(): every query in one batch
// is sent in a single HTTP request and committed atomically by Postgres.
// That is the storage boundary for a seat-map replacement.
function seatValues(auditoriumId: string, list: z.output<typeof auditoriumWriteSchema>['seats']) {
  return list.map((seat) => ({
    auditoriumId,
    rowLabel: seat.rowLabel,
    seatNumber: seat.seatNumber,
    aisleAfter: seat.aisleAfter,
    isOutOfService: seat.isOutOfService,
  }))
}

// A batch needs a runnable query for the "no seats" case; a tiny read is a
// harmless no-op that keeps the delete + insert + read shape identical.
const noSeatsPlaceholder = (db: ReturnType<typeof getDb>, auditoriumId: string) =>
  db.select({ id: auditoriums.id }).from(auditoriums).where(eq(auditoriums.id, auditoriumId))

cinemaAdminRoutes.get('/films', requireAdmin, async (c) => {
  const rows = await getDb()
    .select({
      id: films.id,
      title: films.title,
      durationMinutes: films.durationMinutes,
      synopsis: films.synopsis,
      posterUrl: films.posterUrl,
    })
    .from(films)
    .orderBy(asc(films.title))

  return c.json(rows.map(filmView))
})

cinemaAdminRoutes.post('/films', requireAdmin, zValidator('json', filmWriteSchema), async (c) => {
  const [created] = await getDb()
    .insert(films)
    .values(c.req.valid('json'))
    .returning({
      id: films.id,
      title: films.title,
      durationMinutes: films.durationMinutes,
      synopsis: films.synopsis,
      posterUrl: films.posterUrl,
    })

  return c.json(filmView(created), 201)
})

cinemaAdminRoutes.patch(
  '/films/:id',
  requireAdmin,
  zValidator('param', idSchema),
  zValidator('json', filmWriteSchema),
  async (c) => {
    const [updated] = await getDb()
      .update(films)
      .set(c.req.valid('json'))
      .where(eq(films.id, c.req.valid('param').id))
      .returning({
        id: films.id,
        title: films.title,
        durationMinutes: films.durationMinutes,
        synopsis: films.synopsis,
        posterUrl: films.posterUrl,
      })

    if (!updated) return c.json({ error: 'film_not_found' }, 404)

    return c.json(filmView(updated))
  },
)

cinemaAdminRoutes.get('/auditoriums', requireAdmin, async (c) => {
  const db = getDb()
  const rows = await db
    .select({ id: auditoriums.id, name: auditoriums.name })
    .from(auditoriums)
    .orderBy(asc(auditoriums.name))

  if (rows.length === 0) return c.json([])

  const allSeats = await orderedSeats(
    db,
    rows.map((row) => row.id),
  )
  const byAuditorium = new Map<string, SeatWithAuditorium[]>()
  for (const seat of allSeats) {
    const list = byAuditorium.get(seat.auditoriumId) ?? []
    list.push(seat)
    byAuditorium.set(seat.auditoriumId, list)
  }

  return c.json(rows.map((row) => auditoriumView(row, byAuditorium.get(row.id) ?? [])))
})

cinemaAdminRoutes.post(
  '/auditoriums',
  requireAdmin,
  zValidator('json', auditoriumWriteSchema),
  async (c) => {
    const input = c.req.valid('json')
    const db = getDb()
    // The id is generated here so every statement in the batch can reference it.
    const id = randomUUID()
    const values = seatValues(id, input.seats)

    const [auditoriumRows, , seatRows] = await db.batch([
      db.insert(auditoriums).values({ id, name: input.name }).returning({
        id: auditoriums.id,
        name: auditoriums.name,
      }),
      values.length > 0
        ? db.insert(seats).values(values)
        : noSeatsPlaceholder(db, id),
      seatsFor(db, id),
    ])

    return c.json(auditoriumView(auditoriumRows[0], seatRows), 201)
  },
)

cinemaAdminRoutes.put(
  '/auditoriums/:id',
  requireAdmin,
  zValidator('param', idSchema),
  zValidator('json', auditoriumWriteSchema),
  async (c) => {
    const id = c.req.valid('param').id
    const input = c.req.valid('json')
    const db = getDb()
    const [existing] = await db
      .select({ id: auditoriums.id })
      .from(auditoriums)
      .where(eq(auditoriums.id, id))
      .limit(1)
    // Reject before the batch: inserting seats for a missing auditorium would
    // otherwise raise an FK error and surface as a 500 instead of a 404.
    if (!existing) return c.json({ error: 'auditorium_not_found' }, 404)
    const values = seatValues(id, input.seats)

    // Delete, insert and read are one non-interactive transaction. If the
    // insert violates the unique index, the delete is rolled back too.
    const [auditoriumRows, , , seatRows] = await db.batch([
      db
        .update(auditoriums)
        .set({ name: input.name })
        .where(eq(auditoriums.id, id))
        .returning({ id: auditoriums.id, name: auditoriums.name }),
      db.delete(seats).where(eq(seats.auditoriumId, id)),
      values.length > 0
        ? db.insert(seats).values(values)
        : noSeatsPlaceholder(db, id),
      seatsFor(db, id),
    ])

    if (auditoriumRows.length === 0) return c.json({ error: 'auditorium_not_found' }, 404)

    return c.json(auditoriumView(auditoriumRows[0], seatRows))
  },
)
