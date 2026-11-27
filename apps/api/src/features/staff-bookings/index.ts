import { zValidator } from '@hono/zod-validator'
import { and, asc, desc, eq, gte, ilike, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../auth/middleware.js'
import { requireStaff } from '../../auth/middleware.js'
import { getDb } from '../../db/index.js'
import {
  bookingSeats,
  bookings,
  films,
  services,
  showtimes,
  type StoredConfirmationResponse,
} from '../../db/schema.js'

/**
 * B6.1 staff reads. Every route is behind `requireStaff` (admin + operations)
 * and returns a fixed projection: no guest credential, verifier or ciphertext
 * ever leaves this boundary. The B2.3 `GET /bookings` array contract is left
 * untouched so existing clients keep working.
 */
export const staffBookingsRoutes = new Hono<AuthEnv>()
export const staffOccupancyRoutes = new Hono<AuthEnv>()

const idSchema = z.object({ id: z.uuid() })

const listQuerySchema = z.object({
  reference: z.string().trim().max(120).default(''),
  filmId: z.uuid().optional(),
  showtimeId: z.uuid().optional(),
  status: z.enum(['all', 'confirmed', 'cancelled']).default('all'),
  period: z.enum(['upcoming', 'all']).default('upcoming'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)
const toIso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

interface StaffListRow {
  id: string
  reference: string
  customerName: string
  customerEmail: string
  status: 'confirmed' | 'cancelled'
  startsAt: Date
  showtimeStartsAt: Date | null
  filmTitle: string | null
  serviceName: string | null
  unitPricePiastres: number | null
  totalPiastres: number | null
  cancelledAt: Date | null
  idempotencyResponse: StoredConfirmationResponse | null
}

/** Frozen confirmation data wins; prototype rows fall back to their own columns. */
function listItem(row: StaffListRow) {
  const frozen = row.idempotencyResponse
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    filmTitle: frozen?.filmTitle ?? row.filmTitle ?? null,
    serviceName: row.serviceName,
    startsAt: frozen?.startsAt ?? toIso(row.showtimeStartsAt ?? row.startsAt),
    auditoriumName: frozen?.auditoriumName ?? null,
    seatCount: frozen?.seatIds.length ?? null,
    unitPricePiastres: row.unitPricePiastres,
    totalPiastres: row.totalPiastres,
    cancelledAt: toIso(row.cancelledAt),
  }
}

function staffConditions(query: z.infer<typeof listQuerySchema>) {
  const conditions = []
  if (query.reference) {
    conditions.push(ilike(bookings.reference, `%${escapeLike(query.reference)}%`))
  }
  if (query.filmId) conditions.push(eq(showtimes.filmId, query.filmId))
  if (query.showtimeId) conditions.push(eq(bookings.showtimeId, query.showtimeId))
  if (query.status !== 'all') conditions.push(eq(bookings.status, query.status))
  if (query.period === 'upcoming') {
    const now = new Date()
    // Prototype rows have no showtime; use their own stored start instant.
    conditions.push(
      or(
        gte(showtimes.startsAt, now),
        and(isNull(bookings.showtimeId), gte(bookings.startsAt, now)),
      )!,
    )
  }
  return conditions.length ? and(...conditions) : undefined
}

// Filters are registered before /:id so Hono cannot treat "filters" as an id.
staffBookingsRoutes.get('/filters', requireStaff, async (c) => {
  const db = getDb()
  const filmsRows = await db
    .select({ id: films.id, title: films.title })
    .from(films)
    .orderBy(asc(films.title))

  const showtimeRows = await db
    .select({
      id: showtimes.id,
      filmTitle: films.title,
      startsAt: showtimes.startsAt,
      auditoriumName: showtimes.layoutSnapshot,
      status: showtimes.status,
    })
    .from(showtimes)
    .innerJoin(films, eq(showtimes.filmId, films.id))
    .orderBy(desc(showtimes.startsAt))
    .limit(500)

  return c.json({
    films: filmsRows,
    showtimes: showtimeRows.map((row) => ({
      id: row.id,
      filmTitle: row.filmTitle,
      startsAt: row.startsAt.toISOString(),
      auditoriumName: row.auditoriumName?.auditoriumName ?? null,
      status: row.status,
    })),
  })
})

staffBookingsRoutes.get('/', requireStaff, zValidator('query', listQuerySchema), async (c) => {
  const query = c.req.valid('query')
  const where = staffConditions(query)
  const db = getDb()

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .leftJoin(showtimes, eq(bookings.showtimeId, showtimes.id))
  const counted = await (where ? countQuery.where(where) : countQuery)
  const total = counted[0]?.count ?? 0

  const rows = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      status: bookings.status,
      startsAt: bookings.startsAt,
      showtimeStartsAt: showtimes.startsAt,
      filmTitle: films.title,
      serviceName: services.name,
      unitPricePiastres: bookings.unitPricePiastres,
      totalPiastres: bookings.totalPiastres,
      cancelledAt: bookings.cancelledAt,
      idempotencyResponse: bookings.idempotencyResponse,
    })
    .from(bookings)
    .leftJoin(showtimes, eq(bookings.showtimeId, showtimes.id))
    .leftJoin(films, eq(showtimes.filmId, films.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(where ?? sql`true`)
    .orderBy(
      desc(sql`coalesce(${showtimes.startsAt}, ${bookings.startsAt})`),
      desc(bookings.createdAt),
      asc(bookings.id),
    )
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)

  return c.json({
    items: rows.map((row) => listItem(row)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.ceil(total / query.pageSize),
  })
})

staffBookingsRoutes.get('/:id', requireStaff, async (c) => {
  // A malformed id gets the same generic denial as an unknown one; staff reads
  // never expose validator details about which bookings do or do not exist.
  const parsed = idSchema.safeParse({ id: c.req.param('id') })
  if (!parsed.success) return c.json({ error: 'booking_not_found' }, 404)
  const { id } = parsed.data
  const [row] = await getDb()
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      startsAt: bookings.startsAt,
      showtimeId: bookings.showtimeId,
      showtimeStatus: showtimes.status,
      filmTitle: films.title,
      serviceName: services.name,
      unitPricePiastres: bookings.unitPricePiastres,
      totalPiastres: bookings.totalPiastres,
      cancelledAt: bookings.cancelledAt,
      cancelledByUserId: bookings.cancelledByUserId,
      cancellationReason: bookings.cancellationReason,
      guestLinkExpiresAt: bookings.guestLinkExpiresAt,
      idempotencyResponse: bookings.idempotencyResponse,
    })
    .from(bookings)
    .leftJoin(showtimes, eq(bookings.showtimeId, showtimes.id))
    .leftJoin(films, eq(showtimes.filmId, films.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.id, id))
    .limit(1)

  if (!row) return c.json({ error: 'booking_not_found' }, 404)

  const common = {
    id: row.id,
    reference: row.reference,
    status: row.status,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    cancelledAt: toIso(row.cancelledAt),
    cancelledByUserId: row.cancelledByUserId,
    cancellationReason: row.cancellationReason,
    guestLinkSent: Boolean(row.guestLinkExpiresAt),
    guestLinkExpiresAt: toIso(row.guestLinkExpiresAt),
  }

  const frozen = row.idempotencyResponse
  if (frozen) {
    return c.json({
      ...common,
      filmTitle: frozen.filmTitle,
      startsAt: frozen.startsAt,
      showtimeId: frozen.showtimeId,
      showtimeStatus: row.showtimeStatus ?? null,
      auditoriumName: frozen.auditoriumName,
      seatLabels: frozen.seatLabels,
      unitPricePiastres: row.unitPricePiastres,
      totalPiastres: row.totalPiastres,
    })
  }

  // Legacy prototype rows predate the frozen confirmation snapshot.
  return c.json({
    ...common,
    serviceName: row.serviceName,
    startsAt: row.startsAt.toISOString(),
    showtimeId: row.showtimeId,
    showtimeStatus: row.showtimeStatus ?? null,
    unitPricePiastres: row.unitPricePiastres,
    totalPiastres: row.totalPiastres,
  })
})

staffOccupancyRoutes.get('/:id/occupancy', requireStaff, async (c) => {
  const parsed = idSchema.safeParse({ id: c.req.param('id') })
  if (!parsed.success) return c.json({ error: 'showtime_not_found' }, 404)
  const { id } = parsed.data
  const [showtime] = await getDb()
    .select({
      id: showtimes.id,
      filmTitle: films.title,
      startsAt: showtimes.startsAt,
      status: showtimes.status,
      layoutSnapshot: showtimes.layoutSnapshot,
    })
    .from(showtimes)
    .innerJoin(films, eq(showtimes.filmId, films.id))
    .where(eq(showtimes.id, id))
    .limit(1)

  if (!showtime) return c.json({ error: 'showtime_not_found' }, 404)
  if (!showtime.layoutSnapshot) return c.json({ error: 'showtime_not_ready' }, 409)

  // Count only claims of confirmed bookings. Every cancellation path also
  // deletes its claims, but the join keeps a stray/orphan row from reporting a
  // released seat as booked.
  const claims = await getDb()
    .select({ seatId: bookingSeats.seatId })
    .from(bookingSeats)
    .innerJoin(bookings, eq(bookingSeats.bookingId, bookings.id))
    .where(and(eq(bookingSeats.showtimeId, id), eq(bookings.status, 'confirmed')))

  const claimed = new Set(claims.map((claim) => claim.seatId))
  const seats = showtime.layoutSnapshot.seats
  const outOfServiceSeats = seats.filter((seat) => seat.outOfService).length
  const bookableSeats = seats.length - outOfServiceSeats
  const bookedSeats = seats.filter((seat) => !seat.outOfService && claimed.has(seat.id)).length

  return c.json({
    showtimeId: showtime.id,
    filmTitle: showtime.filmTitle,
    startsAt: showtime.startsAt.toISOString(),
    auditoriumName: showtime.layoutSnapshot.auditoriumName,
    status: showtime.status,
    totalSeats: seats.length,
    outOfServiceSeats,
    bookedSeats,
    availableSeats: bookableSeats - bookedSeats,
    occupancyPercent: bookableSeats ? Math.round((bookedSeats / bookableSeats) * 100) : 0,
  })
})
