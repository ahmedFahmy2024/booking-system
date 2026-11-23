import assert from 'node:assert/strict'
import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

/**
 * B3.5 repeatable fixture seed. Writes only to the isolated
 * `booking_system_test` database and only rows with fixed fixture identifiers,
 * so a second run replaces the first one instead of accumulating data.
 *
 * Showtimes are left as drafts with no snapshot. The publish path is exercised
 * separately by `verify-cinema-paths.ts` through the real admin API route.
 * No connection string, credential or customer detail is printed.
 */

config({ path: '.env.test' })

const connectionString = process.env.DATABASE_URL_UNPOOLED
if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED is not set; load apps/api/.env.test first')
}

const target = new URL(connectionString)
const database = target.pathname.replace(/^\//, '')
const pooled = target.hostname.includes('-pooler')
if (database !== 'booking_system_test' || pooled) {
  throw new Error(
    `Refusing to seed: expected the isolated unpooled booking_system_test database, got ${database} (pooled: ${pooled})`,
  )
}

const sql = neon(connectionString)

const FIXTURE = {
  filmId: '11111111-1111-4111-8111-111111111111',
  screenOneId: '22222222-2222-4222-8222-222222222222',
  soldOutId: '33333333-3333-4333-8333-333333333333',
  showtimeIds: [
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555',
  ],
} as const

const seatId = (n: number) => `66666666-6666-4666-8666-${String(n).padStart(12, '0')}`

const [prototypeBefore] = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`

// Fixed IDs make the fixture idempotent. A booking that references a fixture
// showtime blocks the delete, which protects later tasks against silent resets.
await sql`DELETE FROM showtimes WHERE id IN (${FIXTURE.showtimeIds[0]}, ${FIXTURE.showtimeIds[1]})`
await sql`DELETE FROM auditoriums WHERE id IN (${FIXTURE.screenOneId}, ${FIXTURE.soldOutId})`
await sql`DELETE FROM films WHERE id = ${FIXTURE.filmId}`

await sql`
  INSERT INTO films (id, title, duration_minutes, synopsis, poster_url)
  VALUES (
    ${FIXTURE.filmId},
    'فيلم التجربة',
    120,
    'فيلم تجريبي للتحقق من مسار الحجز في بيئة معزولة.',
    NULL
  )
`

await sql`
  INSERT INTO auditoriums (id, name) VALUES
    (${FIXTURE.screenOneId}, 'B3.5 Screen 1'),
    (${FIXTURE.soldOutId}, 'B3.5 Sold-Out Screen')
`

const seats = [
  { n: 1, auditoriumId: FIXTURE.screenOneId, rowLabel: 'A', seatNumber: 1, aisleAfter: false, outOfService: false },
  { n: 2, auditoriumId: FIXTURE.screenOneId, rowLabel: 'A', seatNumber: 2, aisleAfter: true, outOfService: true },
  { n: 3, auditoriumId: FIXTURE.screenOneId, rowLabel: 'A', seatNumber: 3, aisleAfter: false, outOfService: false },
  { n: 4, auditoriumId: FIXTURE.screenOneId, rowLabel: 'B', seatNumber: 1, aisleAfter: false, outOfService: false },
  { n: 5, auditoriumId: FIXTURE.screenOneId, rowLabel: 'B', seatNumber: 2, aisleAfter: false, outOfService: false },
  { n: 6, auditoriumId: FIXTURE.screenOneId, rowLabel: 'B', seatNumber: 3, aisleAfter: false, outOfService: false },
  { n: 7, auditoriumId: FIXTURE.soldOutId, rowLabel: 'C', seatNumber: 1, aisleAfter: false, outOfService: true },
  { n: 8, auditoriumId: FIXTURE.soldOutId, rowLabel: 'C', seatNumber: 2, aisleAfter: true, outOfService: true },
  { n: 9, auditoriumId: FIXTURE.soldOutId, rowLabel: 'C', seatNumber: 3, aisleAfter: false, outOfService: true },
  { n: 10, auditoriumId: FIXTURE.soldOutId, rowLabel: 'D', seatNumber: 1, aisleAfter: false, outOfService: true },
] as const

for (const seat of seats) {
  await sql`
    INSERT INTO seats (id, auditorium_id, row_label, seat_number, aisle_after, is_out_of_service)
    VALUES (
      ${seatId(seat.n)},
      ${seat.auditoriumId},
      ${seat.rowLabel},
      ${seat.seatNumber},
      ${seat.aisleAfter},
      ${seat.outOfService}
    )
  `
}

// 19:00 and 21:00 Cairo on a summer date (UTC+3). Different auditoriums keep
// the exclusion constraint satisfied even though the occupancy windows overlap.
const showtimes = [
  {
    id: FIXTURE.showtimeIds[0],
    auditoriumId: FIXTURE.screenOneId,
    startsAt: '2030-06-15T16:00:00.000Z',
    occupancyEndsAt: '2030-06-15T18:15:00.000Z',
  },
  {
    id: FIXTURE.showtimeIds[1],
    auditoriumId: FIXTURE.soldOutId,
    startsAt: '2030-06-15T18:00:00.000Z',
    occupancyEndsAt: '2030-06-15T20:15:00.000Z',
  },
] as const

for (const showtime of showtimes) {
  await sql`
    INSERT INTO showtimes (id, film_id, auditorium_id, starts_at, occupancy_ends_at, status, price_piastres)
    VALUES (
      ${showtime.id},
      ${FIXTURE.filmId},
      ${showtime.auditoriumId},
      ${showtime.startsAt},
      ${showtime.occupancyEndsAt},
      'draft',
      0
    )
  `
}

const [prototypeAfter] = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`
assert.deepEqual(prototypeAfter, prototypeBefore, 'prototype rows changed while seeding')

const [fixture] = await sql`
  SELECT
    (SELECT count(*)::int FROM films WHERE id = ${FIXTURE.filmId}) AS films,
    (SELECT count(*)::int FROM auditoriums WHERE id IN (${FIXTURE.screenOneId}, ${FIXTURE.soldOutId})) AS auditoriums,
    (SELECT count(*)::int FROM seats WHERE auditorium_id IN (${FIXTURE.screenOneId}, ${FIXTURE.soldOutId})) AS seats,
    (SELECT count(*)::int FROM showtimes WHERE id IN (${FIXTURE.showtimeIds[0]}, ${FIXTURE.showtimeIds[1]})) AS showtimes,
    (SELECT count(*)::int FROM showtimes WHERE id IN (${FIXTURE.showtimeIds[0]}, ${FIXTURE.showtimeIds[1]}) AND status = 'draft' AND layout_snapshot IS NULL) AS drafts
`

assert.deepEqual(
  fixture,
  { films: 1, auditoriums: 2, seats: 10, showtimes: 2, drafts: 2 },
  'the fixture was not seeded exactly once',
)

console.log(
  JSON.stringify(
    {
      targetDatabase: database,
      pooled,
      fixture,
      prototypeRows: { before: prototypeBefore, after: prototypeAfter },
      showtimeIds: FIXTURE.showtimeIds,
    },
    null,
    2,
  ),
)
