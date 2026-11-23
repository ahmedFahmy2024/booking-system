import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

/**
 * Read-only rehearsal check for B3.1. Prints counts and a fingerprint of the
 * prototype rows, plus the presence and nullability of the cinema schema.
 * Tolerates databases that have not yet applied the B2.4 migration.
 * Never prints connection strings, customer contact details, or link secrets.
 */
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED is not set; load apps/api/.env.test first')
}

const sql = neon(connectionString)

const [state] = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS service_count,
    (SELECT count(*)::int FROM bookings) AS booking_count
`

const columns = await sql`
  SELECT table_name, column_name, is_nullable, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND ((table_name = 'bookings' AND column_name IN ('reference', 'showtime_id')))
  ORDER BY column_name
`

const hasReference = columns.some(
  (row) => row.table_name === 'bookings' && row.column_name === 'reference',
)
const hasShowtimeId = columns.some(
  (row) => row.table_name === 'bookings' && row.column_name === 'showtime_id',
)

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('films', 'auditoriums', 'seats', 'showtimes')
  ORDER BY table_name
`

let bookingReferenceFingerprint: string | null = null
if (hasReference) {
  const [fingerprint] = await sql`
    SELECT md5(coalesce(string_agg(reference, ',' ORDER BY reference), '')) AS value
    FROM bookings
  `
  bookingReferenceFingerprint = fingerprint.value
}

let linkedBookingCount: number | null = null
if (hasShowtimeId) {
  const [linked] = await sql`
    SELECT count(*)::int AS value FROM bookings WHERE showtime_id IS NOT NULL
  `
  linkedBookingCount = linked.value
}

let cinemaData: {
  filmCount: number
  auditoriumCount: number
  seatCount: number
  showtimeCount: number
  showtimeStartsAtType: string | null
} | null = null

if (tables.length === 4) {
  const [counts] = await sql`
    SELECT
      (SELECT count(*)::int FROM films) AS film_count,
      (SELECT count(*)::int FROM auditoriums) AS auditorium_count,
      (SELECT count(*)::int FROM seats) AS seat_count,
      (SELECT count(*)::int FROM showtimes) AS showtime_count
  `
  const startsAt = await sql`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'showtimes'
      AND column_name = 'starts_at'
  `
  cinemaData = {
    filmCount: counts.film_count,
    auditoriumCount: counts.auditorium_count,
    seatCount: counts.seat_count,
    showtimeCount: counts.showtime_count,
    showtimeStartsAtType: startsAt[0]?.data_type ?? null,
  }
}

console.log(
  JSON.stringify(
    {
      serviceCount: state.service_count,
      bookingCount: state.booking_count,
      bookingReferenceFingerprint,
      linkedBookingCount,
      cinemaTables: tables.map((row) => row.table_name),
      bookingColumns: columns.map((row) => ({
        name: row.column_name,
        isNullable: row.is_nullable,
        dataType: row.data_type,
      })),
      cinemaData,
    },
    null,
    2,
  ),
)
