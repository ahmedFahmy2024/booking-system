import 'dotenv/config'
import assert from 'node:assert/strict'
import { neon } from '@neondatabase/serverless'

/**
 * B3.3 storage-boundary rehearsal. Applies only to the isolated
 * `booking_system_test` database and cleans up every row it creates. It proves
 * the partial exclusion constraint rejects an overlapping showtime, permits a
 * back-to-back showtime and a simultaneous one in another auditorium, and lets
 * exactly one of two concurrent claims in the same auditorium win.
 *
 * Never prints a connection string, customer contact detail or guest link.
 */
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED is not set; load apps/api/.env.test first')
}

const target = new URL(connectionString)
if (
  target.pathname.replace(/^\//, '') !== 'booking_system_test' ||
  target.hostname.includes('-pooler')
) {
  throw new Error('Refusing to rehearse: not the isolated unpooled booking_system_test database')
}

const sql = neon(connectionString)

const [extension] = await sql`
  SELECT count(*)::int AS available
  FROM pg_available_extensions
  WHERE name = 'btree_gist'
`
assert.equal(extension.available, 1, 'btree_gist is not available on this database')

const before = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`

// An interrupted earlier run must not break setup: the auditorium name is
// unique, so clear any leftover fixtures before inserting outside the try.
await sql`
  DELETE FROM showtimes
  WHERE film_id IN (SELECT id FROM films WHERE title = 'B3.3 overlap rehearsal')
`
await sql`DELETE FROM auditoriums WHERE name IN ('B3.3 rehearsal A', 'B3.3 rehearsal B')`
await sql`DELETE FROM films WHERE title = 'B3.3 overlap rehearsal'`

const [film] = await sql`
  INSERT INTO films (title, duration_minutes, synopsis)
  VALUES ('B3.3 overlap rehearsal', 120, 'Temporary rehearsal film')
  RETURNING id
`
const [auditoriumA] = await sql`
  INSERT INTO auditoriums (name) VALUES ('B3.3 rehearsal A') RETURNING id
`
const [auditoriumB] = await sql`
  INSERT INTO auditoriums (name) VALUES ('B3.3 rehearsal B') RETURNING id
`

const startsAt = '2026-12-10T10:00:00.000Z'
const occupancyEndsAt = '2026-12-10T12:15:00.000Z' // 120 min film + 15 min turnaround

type Attempt = 'fulfilled' | 'rejected'
async function attempt(statement: Promise<unknown>): Promise<Attempt> {
  try {
    await statement
    return 'fulfilled'
  } catch (error) {
    const code = (error as { code?: unknown }).code
    assert.equal(code, '23P01', `expected exclusion_violation, got ${String(code)}`)
    return 'rejected'
  }
}

async function claim(auditoriumId: string, start: string, end: string, status = 'published') {
  return attempt(sql`
    INSERT INTO showtimes (film_id, auditorium_id, starts_at, occupancy_ends_at, status, price_piastres)
    VALUES (${film.id}, ${auditoriumId}, ${start}, ${end}, ${status}, 2500)
    RETURNING id
  `)
}

let baseline: Attempt | undefined
let overlapping: Attempt | undefined
let backToBack: Attempt | undefined
let otherAuditorium: Attempt | undefined
let concurrent: Attempt[] | undefined
let overlappingPublishUpdate: Attempt | undefined
let safePublishUpdate: Attempt | undefined
let cancelledReleasesAuditorium: Attempt | undefined

try {
  baseline = await claim(auditoriumA.id, startsAt, occupancyEndsAt)
  overlapping = await claim(auditoriumA.id, '2026-12-10T11:00:00.000Z', '2026-12-10T13:15:00.000Z')
  backToBack = await claim(auditoriumA.id, occupancyEndsAt, '2026-12-10T14:30:00.000Z')
  otherAuditorium = await claim(auditoriumB.id, startsAt, occupancyEndsAt)

  // No existing claim in B after the previous insert, so two identical
  // simultaneous claims race for the same auditorium and interval.
  concurrent = await Promise.all([
    claim(auditoriumB.id, '2026-12-11T10:00:00.000Z', '2026-12-11T12:15:00.000Z'),
    claim(auditoriumB.id, '2026-12-11T10:00:00.000Z', '2026-12-11T12:15:00.000Z'),
  ])

  // Publishing is an UPDATE. Two non-overlapping drafts must still be
  // arbitrated if one publish recomputes an overlapping occupancy end.
  const [draft] = await sql`
    INSERT INTO showtimes (film_id, auditorium_id, starts_at, occupancy_ends_at, status, price_piastres)
    VALUES (${film.id}, ${auditoriumA.id}, '2026-12-12T10:00:00.000Z', '2026-12-12T12:15:00.000Z', 'draft', 0)
    RETURNING id
  `
  const [neighbor] = await sql`
    INSERT INTO showtimes (film_id, auditorium_id, starts_at, occupancy_ends_at, status, price_piastres)
    VALUES (${film.id}, ${auditoriumA.id}, '2026-12-12T14:00:00.000Z', '2026-12-12T16:15:00.000Z', 'draft', 0)
    RETURNING id
  `
  overlappingPublishUpdate = await attempt(sql`
    UPDATE showtimes
    SET status = 'published', occupancy_ends_at = '2026-12-12T14:30:00.000Z'
    WHERE id = ${draft.id}
  `)
  safePublishUpdate = await attempt(sql`
    UPDATE showtimes SET status = 'published' WHERE id = ${neighbor.id}
  `)

  // Cancelled showtimes must release the auditorium instead of blocking it.
  await claim(auditoriumA.id, '2026-12-13T10:00:00.000Z', '2026-12-13T12:15:00.000Z')
  const [cancelled] = await sql`
    SELECT id FROM showtimes
    WHERE film_id = ${film.id} AND starts_at = '2026-12-13T10:00:00.000Z'
    LIMIT 1
  `
  await sql`UPDATE showtimes SET status = 'cancelled' WHERE id = ${cancelled.id}`
  cancelledReleasesAuditorium = await claim(
    auditoriumA.id,
    '2026-12-13T11:00:00.000Z',
    '2026-12-13T13:15:00.000Z',
  )
} finally {
  await sql`DELETE FROM showtimes WHERE film_id = ${film.id}`
  await sql`DELETE FROM auditoriums WHERE id IN (${auditoriumA.id}, ${auditoriumB.id})`
  await sql`DELETE FROM films WHERE id = ${film.id}`
}

assert.equal(baseline, 'fulfilled', 'the baseline showtime must be stored')
assert.equal(overlapping, 'rejected', 'an overlapping showtime must be rejected')
assert.equal(backToBack, 'fulfilled', 'a showtime at the exact occupancy end must be allowed')
assert.equal(otherAuditorium, 'fulfilled', 'the same instant in another auditorium must be allowed')
assert.deepEqual(
  concurrent?.sort(),
  ['fulfilled', 'rejected'],
  'exactly one concurrent claim for the same auditorium and interval must win',
)
assert.equal(overlappingPublishUpdate, 'rejected', 'an overlapping publish UPDATE must be rejected')
assert.equal(safePublishUpdate, 'fulfilled', 'a non-overlapping publish UPDATE must be allowed')
assert.equal(cancelledReleasesAuditorium, 'fulfilled', 'a cancelled showtime must release its slot')

const after = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`
assert.deepEqual(after, before, 'prototype rows changed during the rehearsal')

console.log(
  JSON.stringify(
    {
      targetDatabase: target.pathname.replace(/^\//, ''),
      btreeGistAvailable: extension.available === 1,
      baseline,
      overlapping,
      backToBack,
      otherAuditorium,
      concurrent,
      overlappingPublishUpdate,
      safePublishUpdate,
      cancelledReleasesAuditorium,
      prototypeRows: { before, after },
    },
    null,
    2,
  ),
)
