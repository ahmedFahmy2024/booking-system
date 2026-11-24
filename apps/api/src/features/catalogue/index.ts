import { and, asc, eq, gt } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../auth/middleware.js'
import { getDb } from '../../db/index.js'
import { auditoriums, bookingSeats, films, showtimes } from '../../db/schema.js'
import { isBookingClosed, isSeatAvailable } from '../showtimes/schedule.js'

/**
 * B3.4 public reads. All four actors in the permission matrix may browse
 * published showtimes and read their frozen seat map, so these routes have no
 * auth middleware. They are reads only: no booking state is changed here.
 */

const idSchema = z.uuid()

interface SnapshotSeat {
  id: string
  rowLabel: string
  seatNumber: number
  aisleAfter: boolean
  outOfService: boolean
}

interface LayoutSnapshot {
  auditoriumId: string
  auditoriumName: string
  seats: SnapshotSeat[]
}

function isPublished(row: { status: string }): boolean {
  return row.status === 'published'
}

/** D3 freezes the auditorium identity at publish; fall back only for old rows. */
function frozenAuditoriumName(snapshot: unknown, currentName: string): string {
  const name = (snapshot as LayoutSnapshot | null)?.auditoriumName
  return typeof name === 'string' && name ? name : currentName
}

/** Same denial for an unknown id, a bad id, and a non-published showtime. */
function notFound(c: Context<AuthEnv>) {
  return c.json({ error: 'showtime_not_found' }, 404)
}

/**
 * `GET /films`: films with at least one published showtime starting after now,
 * each with those showtimes ordered by instant. Draft, cancelled and past
 * showtimes are excluded. A showtime whose checkout window has closed still
 * appears, per D3.
 */
export const publicFilmRoutes = new Hono<AuthEnv>().get('/', async (c) => {
  const rows = await getDb()
    .select({
      filmId: films.id,
      title: films.title,
      durationMinutes: films.durationMinutes,
      synopsis: films.synopsis,
      posterUrl: films.posterUrl,
      showtimeId: showtimes.id,
      startsAt: showtimes.startsAt,
      pricePiastres: showtimes.pricePiastres,
      auditoriumName: auditoriums.name,
      layoutSnapshot: showtimes.layoutSnapshot,
    })
    .from(films)
    .innerJoin(showtimes, eq(showtimes.filmId, films.id))
    .innerJoin(auditoriums, eq(auditoriums.id, showtimes.auditoriumId))
    .where(and(eq(showtimes.status, 'published'), gt(showtimes.startsAt, new Date())))
    .orderBy(asc(films.title), asc(showtimes.startsAt))

  const byFilm = new Map<
    string,
    {
      id: string
      title: string
      durationMinutes: number
      synopsis: string
      posterUrl: string | null
      showtimes: Array<{
        id: string
        startsAt: string
        pricePiastres: number
        auditoriumName: string
      }>
    }
  >()

  for (const row of rows) {
    let film = byFilm.get(row.filmId)
    if (!film) {
      film = {
        id: row.filmId,
        title: row.title,
        durationMinutes: row.durationMinutes,
        synopsis: row.synopsis,
        posterUrl: row.posterUrl,
        showtimes: [],
      }
      byFilm.set(row.filmId, film)
    }
    film.showtimes.push({
      id: row.showtimeId,
      startsAt: row.startsAt.toISOString(),
      pricePiastres: row.pricePiastres,
      auditoriumName: frozenAuditoriumName(row.layoutSnapshot, row.auditoriumName),
    })
  }

  return c.json([...byFilm.values()])
})

/**
 * `GET /showtimes/:id`: the showtime heading data. Kept separate from the seat
 * map so the heading can render while the independent map request resolves.
 */
export const publicShowtimeRoutes = new Hono<AuthEnv>()
  .get('/:id', async (c) => {
    const parsed = idSchema.safeParse(c.req.param('id'))
    if (!parsed.success) return notFound(c)

    const [row] = await getDb()
      .select({
        id: showtimes.id,
        filmId: showtimes.filmId,
        startsAt: showtimes.startsAt,
        pricePiastres: showtimes.pricePiastres,
        status: showtimes.status,
        title: films.title,
        synopsis: films.synopsis,
        posterUrl: films.posterUrl,
        durationMinutes: films.durationMinutes,
        auditoriumName: auditoriums.name,
        layoutSnapshot: showtimes.layoutSnapshot,
      })
      .from(showtimes)
      .innerJoin(films, eq(films.id, showtimes.filmId))
      .innerJoin(auditoriums, eq(auditoriums.id, showtimes.auditoriumId))
      .where(and(eq(showtimes.id, parsed.data), gt(showtimes.startsAt, new Date())))
      .limit(1)

    if (!row || !isPublished(row)) return notFound(c)

    return c.json({
      id: row.id,
      filmId: row.filmId,
      filmTitle: row.title,
      synopsis: row.synopsis,
      posterUrl: row.posterUrl,
      durationMinutes: row.durationMinutes,
      startsAt: row.startsAt.toISOString(),
      auditoriumName: frozenAuditoriumName(row.layoutSnapshot, row.auditoriumName),
      pricePiastres: row.pricePiastres,
      bookingClosed: isBookingClosed(row.startsAt),
    })
  })
  /**
   * `GET /showtimes/:id/seat-map`: the frozen layout with availability derived
   * from the same out-of-service and claim set that the B4.2 confirmation uses.
   */
  .get('/:id/seat-map', async (c) => {
    const parsed = idSchema.safeParse(c.req.param('id'))
    if (!parsed.success) return notFound(c)

    const [row] = await getDb()
      .select({
        id: showtimes.id,
        status: showtimes.status,
        auditoriumName: auditoriums.name,
        layoutSnapshot: showtimes.layoutSnapshot,
      })
      .from(showtimes)
      .innerJoin(auditoriums, eq(auditoriums.id, showtimes.auditoriumId))
      .where(and(eq(showtimes.id, parsed.data), gt(showtimes.startsAt, new Date())))
      .limit(1)

    if (!row || !isPublished(row)) return notFound(c)
    if (!row.layoutSnapshot) return c.json({ error: 'seat_map_unavailable' }, 409)

    const claimedRows = await getDb()
      .select({ seatId: bookingSeats.seatId })
      .from(bookingSeats)
      .where(eq(bookingSeats.showtimeId, parsed.data))
    const claimedSeatIds = new Set(claimedRows.map((claimed) => claimed.seatId))

    const snapshot = row.layoutSnapshot as LayoutSnapshot
    return c.json({
      showtimeId: row.id,
      auditoriumName: frozenAuditoriumName(snapshot, row.auditoriumName),
      seats: snapshot.seats.map((seat) => ({
        id: seat.id,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        aisleAfter: seat.aisleAfter,
        outOfService: seat.outOfService,
        available: isSeatAvailable(seat, claimedSeatIds),
      })),
    })
  })
