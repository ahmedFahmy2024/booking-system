import assert from 'node:assert/strict'
import { neon } from '@neondatabase/serverless'
import { app } from '../src/app.js'
import { auth } from '../src/auth.js'
import { getDb } from '../src/db/index.js'
import { user } from '../src/db/auth-schema.js'
import { eq } from 'drizzle-orm'

/**
 * B3.5 live rehearsal on the isolated database. Drives the real admin publish
 * route with a dedicated test admin and the B3.4 public reads, including a
 * showtime whose frozen seats are all out of service. Fixture rows are left in
 * place for browser evidence; no credential or customer detail is printed.
 *
 * Run `npm run db:seed:cinema` first: publishing consumes the two drafts, so a
 * second rehearsal needs a fresh seed. A failure mid-run leaves a mixed state;
 * the same seed command is the documented recovery. The synthetic password is
 * for this isolated database only, never for a deployed environment.
 */

// The npm script loads `.env.test` with `--env-file` before the auth module is
// evaluated; `auth.ts` opens the database at import time.

for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const) {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not set; load apps/api/.env.test first`)
  const target = new URL(value)
  const database = target.pathname.replace(/^\//, '')
  const pooled = target.hostname.includes('-pooler')
  if (key === 'DATABASE_URL' ? !pooled : pooled) {
    throw new Error(`Refusing to rehearse: ${key} is not the expected isolated connection type`)
  }
  if (database !== 'booking_system_test') {
    throw new Error(`Refusing to rehearse: ${key} points at ${database}`)
  }
}

const sql = neon(process.env.DATABASE_URL_UNPOOLED!)
const showtimeIds = [
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
] as const
const filmId = '11111111-1111-4111-8111-111111111111'
const unknownId = '99999999-9999-4999-8999-999999999999'

const adminEmail = 'b35-verify-admin@example.com'
const operationsEmail = 'b35-verify-operations@example.com'
const testPassword = 'B35VerifyPass123!'

async function ensureStaff(email: string, role: 'admin' | 'operations') {
  const [existing] = await sql`SELECT id, role, banned FROM "user" WHERE email = ${email} LIMIT 1`
  if (existing) {
    if (existing.banned || existing.role !== role) {
      await getDb()
        .update(user)
        .set({
          ...(existing.banned ? { banned: false, banReason: null } : {}),
          ...(existing.role !== role ? { role } : {}),
        })
        .where(eq(user.id, existing.id))
    }
    return
  }
  await auth.api.createUser({
    body: { email, password: testPassword, name: role === 'admin' ? 'B3.5 Verify Admin' : 'B3.5 Verify Operations', role },
  })
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/)
  assert.ok(match, 'expected a session cookie from sign-in')
  return `better-auth.session_token=${match[1]}`
}

async function signIn(email: string): Promise<string> {
  const response = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify({ email, password: testPassword }),
  })
  assert.equal(response.status, 200, `sign-in failed for the ${email.split('@')[0]} account`)
  return sessionCookie(response)
}

async function publish(id: string, cookie?: string) {
  return app.request(`/admin/showtimes/${id}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'x-forwarded-for': '127.0.0.1',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ pricePiastres: 2500 }),
  })
}

async function getJson(path: string) {
  const response = await app.request(path)
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

interface PublishedShowtime {
  id: string
  status: string
  pricePiastres: number
  layoutSnapshot: {
    auditoriumName: string
    seats: Array<{ rowLabel: string; seatNumber: number; outOfService: boolean }>
  }
}

const [prototypeBefore] = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`

await ensureStaff(adminEmail, 'admin')
await ensureStaff(operationsEmail, 'operations')
const adminCookie = await signIn(adminEmail)
const operationsCookie = await signIn(operationsEmail)

// Default deny, checked before any write: the drafts must survive both attempts.
const anonymousDenial = await publish(showtimeIds[0])
assert.equal(anonymousDenial.status, 401)
const operationsDenial = await publish(showtimeIds[0], operationsCookie)
assert.equal(operationsDenial.status, 403)

const [unpublished] = await sql`
  SELECT count(*)::int AS value
  FROM showtimes
  WHERE id IN (${showtimeIds[0]}, ${showtimeIds[1]}) AND status = 'draft' AND layout_snapshot IS NULL
`
assert.equal(unpublished.value, 2, 'a denied publish must leave both drafts unchanged')

const draftDetail = await getJson(`/showtimes/${showtimeIds[0]}`)
assert.equal(draftDetail.status, 404, 'a draft must be invisible to a customer')
assert.deepEqual(draftDetail.body, { error: 'showtime_not_found' })

const catalogueBefore = await getJson('/films')
assert.equal(catalogueBefore.status, 200)
assert.deepEqual(catalogueBefore.body, [], 'drafts must not appear in the public catalogue')

const published: PublishedShowtime[] = []
for (const id of showtimeIds) {
  const response = await publish(id, adminCookie)
  assert.equal(response.status, 200, await response.clone().text())
  published.push((await response.json()) as PublishedShowtime)
}
for (const showtime of published) {
  assert.equal(showtime.status, 'published')
  assert.equal(showtime.pricePiastres, 2500)
  assert.ok(showtime.layoutSnapshot, 'publish must freeze the layout snapshot')
}

const catalogue = await getJson('/films')
assert.equal(catalogue.status, 200)
const films = catalogue.body as unknown as Array<{
  id: string
  title: string
  showtimes: Array<{ id: string; auditoriumName: string; pricePiastres: number }>
}>
const film = films.find((row) => row.id === filmId)
assert.ok(film, 'the seeded film must be published in the catalogue')
assert.deepEqual(
  film.showtimes.map((row) => row.id).sort(),
  [...showtimeIds].sort(),
)
assert.deepEqual(
  film.showtimes.map((row) => row.auditoriumName).sort(),
  ['B3.5 Screen 1', 'B3.5 Sold-Out Screen'].sort(),
  'catalogue must use the auditorium name frozen at publish',
)

const [mixed, soldOut] = showtimeIds
const mixedDetail = await getJson(`/showtimes/${mixed}`)
assert.equal(mixedDetail.status, 200)
assert.equal(mixedDetail.body.bookingClosed, false)
const soldOutDetail = await getJson(`/showtimes/${soldOut}`)
assert.equal(soldOutDetail.status, 200)

async function seatMap(id: string) {
  const result = await getJson(`/showtimes/${id}/seat-map`)
  assert.equal(result.status, 200)
  const map = result.body as unknown as {
    auditoriumName: string
    seats: Array<{ rowLabel: string; seatNumber: number; outOfService: boolean; available: boolean }>
  }
  return map
}

const mixedMap = await seatMap(mixed)
assert.equal(mixedMap.auditoriumName, 'B3.5 Screen 1')
assert.equal(mixedMap.seats.length, 6)
assert.equal(mixedMap.seats.filter((seat) => seat.available).length, 5)
assert.deepEqual(
  mixedMap.seats.filter((seat) => !seat.available).map((seat) => `${seat.rowLabel}${seat.seatNumber}`),
  ['A2'],
)

const soldOutMap = await seatMap(soldOut)
assert.equal(soldOutMap.auditoriumName, 'B3.5 Sold-Out Screen')
assert.equal(soldOutMap.seats.length, 4)
assert.equal(soldOutMap.seats.filter((seat) => seat.available).length, 0)
assert.ok(soldOutMap.seats.every((seat) => seat.outOfService))

const unknownDetail = await getJson(`/showtimes/${unknownId}`)
assert.equal(unknownDetail.status, 404)
assert.deepEqual(unknownDetail.body, { error: 'showtime_not_found' })

const [prototypeAfter] = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`
assert.deepEqual(prototypeAfter, prototypeBefore, 'prototype rows changed during the rehearsal')

console.log(
  JSON.stringify(
    {
      targetDatabase: 'booking_system_test',
      denials: { anonymous: anonymousDenial.status, operations: operationsDenial.status },
      draftInvisible: { detail: draftDetail.status, catalogueCount: (catalogueBefore.body as unknown[]).length },
      published: published.map((row) => ({ id: row.id, status: row.status, pricePiastres: row.pricePiastres })),
      catalogueShowtimes: film.showtimes.length,
      mixedSeats: { total: mixedMap.seats.length, available: 5, unavailable: ['A2'] },
      soldOutSeats: { total: soldOutMap.seats.length, available: 0 },
      unknownDetail: unknownDetail.status,
      prototypeRows: { before: prototypeBefore, after: prototypeAfter },
    },
    null,
    2,
  ),
)
