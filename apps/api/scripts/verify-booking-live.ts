import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { app } from '../src/app.js'
import { auth } from '../src/auth.js'
import { clearCapturedMessages, getCapturedMessages } from '../src/features/mail/index.js'
import { bookingCutoffAt, isBookingClosed } from '../src/features/showtimes/schedule.js'

/**
 * B4.6 live rehearsal on the isolated database. Drives the real confirmation
 * route with real Neon writes: competing seat claims, a multi-seat conflict,
 * the booking cutoff, concurrent idempotency replay and the price window.
 * B5.3 adds the staff cancellation path and B5.4 the admin showtime
 * cancellation path (including the confirmation race) against the same data.
 * The fixture uses fixed IDs, is removed before and after the run, and never
 * touches prototype rows, credentials or production data. Run with
 * `npm run verify:booking-live`, which loads `.env.test` first; the staff
 * checks require the isolated-only admin from `npm run seed:booking-e2e`.
 */

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

const filmId = '77777777-7777-4777-8777-777777777777'
const auditoriumA = '88888888-8888-4888-8888-888888888888'
const auditoriumB = '99999999-9999-4999-8999-999999999999'
const auditoriumC = 'abababab-abab-4bab-8bab-abababababab'
const showtime = {
  main: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  race: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  closed: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  open: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  price: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  cancelClosed: 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0',
  staffPast: 'bfbfbfbf-bfbf-4fbf-8fbf-bfbfbfbfbfbf',
  adminCancel: 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1',
  adminCancelRace: 'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2',
  adminCancelPast: 'd3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3',
  adminCancelAdmins: 'd5d5d5d5-d5d5-4d5d-8d5d-d5d5d5d5d5d5',
} as const
const seats = {
  a1: 'aaaa0000-0000-4000-8000-000000000001',
  a2: 'aaaa0000-0000-4000-8000-000000000002',
  a3: 'aaaa0000-0000-4000-8000-000000000003',
  a4: 'aaaa0000-0000-4000-8000-000000000004',
  a5: 'aaaa0000-0000-4000-8000-000000000005',
  b1: 'bbbb0000-0000-4000-8000-000000000001',
  b2: 'bbbb0000-0000-4000-8000-000000000002',
  c1: 'cccc0000-0000-4000-8000-000000000001',
} as const
const showtimeIds = Object.values(showtime)

const seatRows = [
  { id: seats.a1, auditoriumId: auditoriumA, rowLabel: 'A', number: 1, outOfService: false },
  { id: seats.a2, auditoriumId: auditoriumA, rowLabel: 'A', number: 2, outOfService: false },
  { id: seats.a3, auditoriumId: auditoriumA, rowLabel: 'A', number: 3, outOfService: true },
  { id: seats.a4, auditoriumId: auditoriumA, rowLabel: 'A', number: 4, outOfService: false },
  { id: seats.a5, auditoriumId: auditoriumA, rowLabel: 'A', number: 5, outOfService: false },
  { id: seats.b1, auditoriumId: auditoriumB, rowLabel: 'B', number: 1, outOfService: false },
  { id: seats.b2, auditoriumId: auditoriumB, rowLabel: 'B', number: 2, outOfService: false },
  { id: seats.c1, auditoriumId: auditoriumC, rowLabel: 'C', number: 1, outOfService: false },
] as const

function snapshot(auditoriumId: string, auditoriumName: string) {
  return JSON.stringify({
    auditoriumId,
    auditoriumName,
    seats: seatRows
      .filter((seat) => seat.auditoriumId === auditoriumId)
      .map((seat) => ({
        id: seat.id,
        rowLabel: seat.rowLabel,
        seatNumber: seat.number,
        aisleAfter: false,
        outOfService: seat.outOfService,
      })),
  })
}

async function cleanup() {
  for (const id of showtimeIds) {
    await sql`DELETE FROM booking_seats WHERE showtime_id = ${id}`
  }
  for (const id of showtimeIds) {
    await sql`DELETE FROM bookings WHERE showtime_id = ${id}`
  }
  for (const id of showtimeIds) {
    await sql`DELETE FROM showtimes WHERE id = ${id}`
  }
  await sql`DELETE FROM auditoriums WHERE id IN (${auditoriumA}, ${auditoriumB}, ${auditoriumC})`
  await sql`DELETE FROM films WHERE id = ${filmId}`
}

const now = Date.now()
const minutesFromNow = (minutes: number) => new Date(now + minutes * 60_000).toISOString()
const startsAt = {
  [showtime.main]: minutesFromNow(1440),
  [showtime.race]: minutesFromNow(5760),
  [showtime.closed]: minutesFromNow(14),
  [showtime.open]: minutesFromNow(16),
  [showtime.price]: minutesFromNow(4320),
  // The two-hour guest cutoff for this showtime is the rehearsal start, so by
  // the time the cancellation request runs it is already closed.
  [showtime.cancelClosed]: minutesFromNow(120),
  // B5.3: staff may cancel on request only before the showtime starts.
  [showtime.staffPast]: minutesFromNow(-60),
  // B5.4: an upcoming showtime with a booking, a race fixture and a started one.
  [showtime.adminCancel]: minutesFromNow(2880),
  [showtime.adminCancelRace]: minutesFromNow(720),
  [showtime.adminCancelPast]: minutesFromNow(-300),
  [showtime.adminCancelAdmins]: minutesFromNow(1440),
} as Record<string, string>

async function seed() {
  await sql`
    INSERT INTO films (id, title, duration_minutes, synopsis, poster_url)
    VALUES (${filmId}, 'فيلم التحقق الحي', 120, 'فيلم للتحقق من الحجز في قاعدة معزولة.', NULL)
  `
  await sql`
    INSERT INTO auditoriums (id, name) VALUES
      (${auditoriumA}, 'B4.6 Screen A'),
      (${auditoriumB}, 'B4.6 Screen B'),
      (${auditoriumC}, 'B4.6 Screen C')
  `
  for (const seat of seatRows) {
    await sql`
      INSERT INTO seats (id, auditorium_id, row_label, seat_number, aisle_after, is_out_of_service)
      VALUES (${seat.id}, ${seat.auditoriumId}, ${seat.rowLabel}, ${seat.number}, false, ${seat.outOfService})
    `
  }
  for (const id of showtimeIds) {
    const start = new Date(startsAt[id])
    const endsAt = new Date(start.getTime() + 135 * 60_000).toISOString()
    const targetAuditorium =
      id === showtime.cancelClosed || id === showtime.staffPast
        ? auditoriumC
        : id === showtime.main ||
            id === showtime.race ||
            id === showtime.closed ||
            id === showtime.adminCancelPast
          ? auditoriumA
          : auditoriumB
    const auditoriumName =
      targetAuditorium === auditoriumC
        ? 'B4.6 Screen C'
        : targetAuditorium === auditoriumA
          ? 'B4.6 Screen A'
          : 'B4.6 Screen B'
    await sql`
      INSERT INTO showtimes
        (id, film_id, auditorium_id, starts_at, occupancy_ends_at, status, price_piastres, layout_snapshot)
      VALUES (
        ${id}, ${filmId}, ${targetAuditorium}, ${start}, ${endsAt},
        'published', 2500,
        ${snapshot(targetAuditorium, auditoriumName)}::jsonb
      )
    `
  }
}

type ConfirmBody = Record<string, unknown> & { error?: string; availableSeatIds?: string[] }

async function confirm(
  payload: {
    showtimeId: string
    seatIds: string[]
    customerEmail: string
    quotedUnitPricePiastres?: number
  },
  key: string,
  ip: string,
): Promise<{ status: number; body: ConfirmBody }> {
  const response = await app.request('/bookings/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
      Origin: 'http://localhost:3000',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(payload),
  })
  return { status: response.status, body: (await response.json()) as ConfirmBody }
}

async function guestCancel(reference: string, token: string | undefined, ip: string) {
  return app.request(`/guest/bookings/${encodeURIComponent(reference)}/cancel`, {
    method: 'POST',
    headers: {
      ...(token ? { 'x-guest-token': token } : {}),
      'x-forwarded-for': ip,
    },
  })
}

// The isolated-only admin is created by `npm run seed:booking-e2e`; no
// credential is printed and the guard above refuses any other database.
const staffEmail = 'b46-e2e-admin@example.com'
const staffPassword = 'B46E2EPass123!'
// A second isolated-only staff member makes the race test able to detect an
// actor overwrite, which a race between two identical sessions cannot.
const opsEmail = 'b53-ops@example.com'
const opsPassword = 'B53OpsPass123!'

function sessionCookie(response: Response): string {
  const match = /(?:__Secure-)?better-auth\.session_token=([^;]+)/.exec(
    response.headers.get('set-cookie') ?? '',
  )
  assert.ok(match, 'the staff sign-in returned no session cookie')
  return `better-auth.session_token=${match[1]}`
}

async function staffSignInAs(
  email: string,
  password: string,
): Promise<{ cookie: string; actorId: string }> {
  const signedIn = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'x-forwarded-for': '203.0.113.40',
    },
    body: JSON.stringify({ email, password }),
  })
  assert.equal(signedIn.status, 200, await signedIn.clone().text())
  const [actor] = await sql`SELECT id FROM "user" WHERE email = ${email}`
  assert.ok(actor, 'the isolated staff account is missing')
  return { cookie: sessionCookie(signedIn), actorId: String(actor.id) }
}

async function ensureOperationsStaff() {
  const [existing] = await sql`
    SELECT id, role, banned FROM "user" WHERE email = ${opsEmail}
  `
  if (!existing) {
    await auth.api.createUser({
      body: {
        name: 'B5.3 Ops',
        email: opsEmail,
        password: opsPassword,
        role: 'operations',
      },
    })
  } else if (existing.role !== 'operations' || existing.banned) {
    await sql`
      UPDATE "user" SET role = 'operations', banned = false, ban_reason = NULL
      WHERE email = ${opsEmail}
    `
  }
  return staffSignInAs(opsEmail, opsPassword)
}

async function staffCancel(id: string, reason: string, cookie?: string) {
  return app.request(`/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'x-forwarded-for': '203.0.113.41',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ reason }),
  })
}

// A second isolated-only admin makes the competing-cancellation test able to
// detect an actor/reason overwrite, which two identical sessions cannot.
const secondAdminEmail = 'b54-admin-2@example.com'
const secondAdminPassword = 'B54Admin2Pass123!'

async function ensureSecondAdmin() {
  const [existing] = await sql`
    SELECT id, role, banned FROM "user" WHERE email = ${secondAdminEmail}
  `
  if (!existing) {
    await auth.api.createUser({
      body: {
        name: 'B5.4 Admin 2',
        email: secondAdminEmail,
        password: secondAdminPassword,
        role: 'admin',
      },
    })
  } else if (existing.role !== 'admin' || existing.banned) {
    await sql`
      UPDATE "user" SET role = 'admin', banned = false, ban_reason = NULL
      WHERE email = ${secondAdminEmail}
    `
  }
  return staffSignInAs(secondAdminEmail, secondAdminPassword)
}

async function staffRead(path: string, cookie?: string) {
  return app.request(path, {
    headers: {
      Origin: 'http://localhost:3000',
      'x-forwarded-for': '203.0.113.45',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  })
}

async function adminCancelShowtime(id: string, reason: string, cookie?: string) {
  return app.request(`/admin/showtimes/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'x-forwarded-for': '203.0.113.44',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ reason }),
  })
}

async function counts(id: string) {
  const [row] = await sql`
    SELECT
      (SELECT count(*)::int FROM bookings WHERE showtime_id = ${id}) AS bookings,
      (SELECT count(*)::int FROM booking_seats WHERE showtime_id = ${id}) AS claims
  `
  return { bookings: Number(row.bookings), claims: Number(row.claims) }
}

async function claimedSeats(id: string): Promise<string[]> {
  const rows = await sql`SELECT seat_id FROM booking_seats WHERE showtime_id = ${id}`
  return rows.map((row) => String(row.seat_id)).sort()
}

function guestMails(email: string): number {
  return getCapturedMessages().filter((message) => message.kind === 'guest-link' && message.to === email).length
}

const results: Record<string, unknown> = {}
const prototypeBefore = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`

try {
  await cleanup()
  clearCapturedMessages()
  await seed()

  // AC6: two concurrent confirmations with one key replay the same outcome.
  const idemEmail = 'b46-idem@example.com'
  const idemPayload = {
    showtimeId: showtime.main,
    seatIds: [seats.a1],
    customerEmail: idemEmail,
    quotedUnitPricePiastres: 2500,
  }
  const idemKey = randomUUID()
  const [first, second] = await Promise.all([
    confirm(idemPayload, idemKey, '203.0.113.10'),
    confirm(idemPayload, idemKey, '203.0.113.11'),
  ])
  assert.equal(first.status, 201, JSON.stringify(first.body))
  assert.equal(second.status, 201, JSON.stringify(second.body))
  assert.equal(JSON.stringify(first.body), JSON.stringify(second.body))
  assert.deepEqual(await counts(showtime.main), { bookings: 1, claims: 1 })
  assert.equal(guestMails(idemEmail), 1)
  const replay = await confirm(idemPayload, idemKey, '203.0.113.10')
  assert.equal(replay.status, 201)
  assert.equal(JSON.stringify(replay.body), JSON.stringify(first.body))
  assert.equal(guestMails(idemEmail), 1)
  const keyConflict = await confirm(
    { ...idemPayload, seatIds: [seats.a2] },
    idemKey,
    '203.0.113.10',
  )
  assert.equal(keyConflict.status, 409)
  assert.equal(keyConflict.body.error, 'idempotency_key_conflict')
  assert.deepEqual(await counts(showtime.main), { bookings: 1, claims: 1 })
  assert.equal(guestMails(idemEmail), 1)
  results.idempotency = {
    concurrentStatuses: [first.status, second.status],
    byteIdenticalBodies: JSON.stringify(first.body) === JSON.stringify(second.body),
    replayStatus: replay.status,
    keyConflictStatus: keyConflict.status,
    stored: await counts(showtime.main),
    guestMails: guestMails(idemEmail),
  }

  // B5.1: the emailed private link is the only way to read the frozen booking
  // detail. The mail adapter is in-process, so this rehearsal can use the real
  // credential without printing or storing it.
  const guestMail = getCapturedMessages().find(
    (message) => message.kind === 'guest-link' && message.to === idemEmail,
  )
  assert.ok(guestMail, 'the confirmation did not email a guest link')
  const linkMatch = /(https?:\/\/[^\s]+)/.exec(guestMail.text)
  assert.ok(linkMatch, 'the guest mail has no link')
  const link = new URL(linkMatch[1])
  const token = link.searchParams.get('token')
  assert.ok(token, 'the guest link has no credential')
  const detailResponse = await app.request(link.pathname + link.search, {
    headers: { 'x-forwarded-for': '203.0.113.20' },
  })
  assert.equal(detailResponse.status, 200)
  const guestDetailBody = (await detailResponse.json()) as Record<string, unknown>
  assert.equal(guestDetailBody.reference, first.body.reference)
  assert.equal(guestDetailBody.filmTitle, 'فيلم التحقق الحي')
  assert.equal(guestDetailBody.auditoriumName, 'B4.6 Screen A')
  assert.deepEqual(guestDetailBody.seatLabels, ['A1'])
  assert.equal(guestDetailBody.totalPiastres, 2500)
  assert.equal(guestDetailBody.customerEmail, idemEmail)
  assert.equal(detailResponse.headers.get('Cache-Control'), 'no-store')
  assert.equal(detailResponse.headers.get('Referrer-Policy'), 'no-referrer')
  assert.ok(!JSON.stringify(guestDetailBody).includes(token), 'the token was reflected in the detail')
  const referenceOnly = await app.request(link.pathname, {
    headers: { 'x-forwarded-for': '203.0.113.21' },
  })
  assert.equal(referenceOnly.status, 404)
  const referenceOnlyBody = await referenceOnly.json()
  assert.deepEqual(referenceOnlyBody, { error: 'guest_link_invalid' })
  assert.ok(!JSON.stringify(referenceOnlyBody).includes(idemEmail))
  results.guestDetail = {
    detailStatus: detailResponse.status,
    frozenFilm: guestDetailBody.filmTitle,
    frozenAuditorium: guestDetailBody.auditoriumName,
    frozenSeats: guestDetailBody.seatLabels,
    tokenReflected: JSON.stringify(guestDetailBody).includes(token),
    referenceOnlyStatus: referenceOnly.status,
    referenceOnlyError: (referenceOnlyBody as { error: string }).error,
  }

  // AC3: two different guests race for the same free seat.
  const raceEmailA = 'b46-race-a@example.com'
  const raceEmailB = 'b46-race-b@example.com'
  const [claimA, claimB] = await Promise.all([
    confirm(
      { showtimeId: showtime.main, seatIds: [seats.a2], customerEmail: raceEmailA, quotedUnitPricePiastres: 2500 },
      randomUUID(),
      '203.0.113.12',
    ),
    confirm(
      { showtimeId: showtime.main, seatIds: [seats.a2], customerEmail: raceEmailB, quotedUnitPricePiastres: 2500 },
      randomUUID(),
      '203.0.113.13',
    ),
  ])
  const statuses = [claimA.status, claimB.status].sort()
  assert.deepEqual(statuses, [201, 409])
  const loser = claimA.status === 409 ? claimA : claimB
  assert.equal(loser.body.error, 'seat_unavailable')
  assert.ok(!(loser.body.availableSeatIds ?? []).includes(seats.a2))
  assert.deepEqual(await counts(showtime.main), { bookings: 2, claims: 2 })
  assert.deepEqual(await claimedSeats(showtime.main), [seats.a1, seats.a2].sort())
  assert.equal(guestMails(raceEmailA) + guestMails(raceEmailB), 1)
  results.competingClaims = {
    statuses,
    loserError: loser.body.error,
    loserAvailable: loser.body.availableSeatIds,
    stored: await counts(showtime.main),
  }

  // AC4: a multi-seat request that includes a claimed seat writes nothing.
  const retryEmail = 'b46-multi@example.com'
  const multi = await confirm(
    { showtimeId: showtime.main, seatIds: [seats.a2, seats.a4], customerEmail: retryEmail, quotedUnitPricePiastres: 2500 },
    randomUUID(),
    '203.0.113.14',
  )
  assert.equal(multi.status, 409)
  assert.equal(multi.body.error, 'seat_unavailable')
  assert.deepEqual(multi.body.availableSeatIds, [seats.a4])
  assert.deepEqual(await counts(showtime.main), { bookings: 2, claims: 2 })
  assert.ok(!(await claimedSeats(showtime.main)).includes(seats.a4))
  assert.equal(guestMails(retryEmail), 0)
  const multiRetry = await confirm(
    { showtimeId: showtime.main, seatIds: [seats.a4], customerEmail: retryEmail, quotedUnitPricePiastres: 2500 },
    randomUUID(),
    '203.0.113.14',
  )
  assert.equal(multiRetry.status, 201)
  assert.deepEqual(await counts(showtime.main), { bookings: 3, claims: 3 })
  assert.equal(guestMails(retryEmail), 1)
  results.multiSeatConflict = {
    status: multi.status,
    availableSeatIds: multi.body.availableSeatIds,
    storedBeforeRetry: { bookings: 2, claims: 2 },
    retryStatus: multiRetry.status,
    storedAfterRetry: await counts(showtime.main),
  }

  // AC5: the exact cutoff is closed; one minute later checkout is open.
  const closed = new Date(startsAt[showtime.closed])
  const open = new Date(startsAt[showtime.open])
  const cutoff = bookingCutoffAt(closed)
  assert.equal(isBookingClosed(closed, cutoff), true)
  assert.equal(isBookingClosed(closed, new Date(cutoff.getTime() - 1)), false)
  assert.equal(isBookingClosed(open, cutoff), false)
  const closedConfirm = await confirm(
    { showtimeId: showtime.closed, seatIds: [seats.a5], customerEmail: 'b46-closed@example.com', quotedUnitPricePiastres: 2500 },
    randomUUID(),
    '203.0.113.15',
  )
  assert.equal(closedConfirm.status, 409)
  assert.equal(closedConfirm.body.error, 'booking_closed')
  assert.deepEqual(await counts(showtime.closed), { bookings: 0, claims: 0 })
  const openConfirm = await confirm(
    { showtimeId: showtime.open, seatIds: [seats.b1], customerEmail: 'b46-open@example.com', quotedUnitPricePiastres: 2500 },
    randomUUID(),
    '203.0.113.15',
  )
  assert.equal(openConfirm.status, 201)
  assert.deepEqual(await counts(showtime.open), { bookings: 1, claims: 1 })
  results.bookingCutoff = {
    exactInstantClosed: true,
    oneMillisecondBeforeOpen: true,
    beforeCutoffStatus: closedConfirm.status,
    afterCutoffStatus: openConfirm.status,
  }

  // AC7: a price change after a public read must be acknowledged by the guest.
  const publicDetail = await app.request(`/showtimes/${showtime.price}`)
  assert.equal(publicDetail.status, 200)
  const detail = (await publicDetail.json()) as { pricePiastres: number }
  assert.equal(detail.pricePiastres, 2500)
  await sql`UPDATE showtimes SET price_piastres = 3000 WHERE id = ${showtime.price}`
  const staleQuote = await confirm(
    { showtimeId: showtime.price, seatIds: [seats.b2], customerEmail: 'b46-price@example.com', quotedUnitPricePiastres: 2500 },
    randomUUID(),
    '203.0.113.16',
  )
  assert.equal(staleQuote.status, 409)
  assert.equal(staleQuote.body.error, 'price_changed')
  assert.equal(staleQuote.body.unitPricePiastres, 3000)
  assert.deepEqual(staleQuote.body.availableSeatIds, [seats.b2])
  const unquoted = await confirm(
    { showtimeId: showtime.price, seatIds: [seats.b2], customerEmail: 'b46-price@example.com' },
    randomUUID(),
    '203.0.113.16',
  )
  assert.equal(unquoted.status, 201)
  assert.equal(unquoted.body.unitPricePiastres, 3000)
  const storedPrice = await sql`SELECT unit_price_piastres FROM bookings WHERE showtime_id = ${showtime.price}`
  assert.equal(Number(storedPrice[0].unit_price_piastres), 3000)
  results.priceWindow = {
    readPrice: detail.pricePiastres,
    staleQuoteStatus: staleQuote.status,
    revisedPrice: staleQuote.body.unitPricePiastres,
    unquotedStatus: unquoted.status,
    storedPrice: Number(storedPrice[0].unit_price_piastres),
    residual: 'the API still reads then writes in one window; a quote from the guest is what closes the user-visible gap',
  }

  // AC7 follow-up: a loser that reaches the catch path must report the seats
  // the winner actually left free. Concurrency makes this path probabilistic,
  // so the assertion always compares the response with the stored claims.
  const [overlapA, overlapB] = await Promise.all([
    confirm(
      { showtimeId: showtime.race, seatIds: [seats.a1, seats.a2], customerEmail: 'b46-overlap-a@example.com', quotedUnitPricePiastres: 2500 },
      randomUUID(),
      '203.0.113.17',
    ),
    confirm(
      { showtimeId: showtime.race, seatIds: [seats.a2, seats.a4], customerEmail: 'b46-overlap-b@example.com', quotedUnitPricePiastres: 2500 },
      randomUUID(),
      '203.0.113.18',
    ),
  ])
  assert.deepEqual([overlapA.status, overlapB.status].sort(), [201, 409])
  const overlapLoser = overlapA.status === 409 ? overlapA : overlapB
  const winnerSeats = await claimedSeats(showtime.race)
  const requested = overlapLoser === overlapA ? [seats.a1, seats.a2] : [seats.a2, seats.a4]
  assert.deepEqual(
    [...(overlapLoser.body.availableSeatIds ?? [])].sort(),
    requested.filter((id) => !winnerSeats.includes(id)).sort(),
  )
  results.catchBlockReread = {
    statuses: [overlapA.status, overlapB.status],
    loserAvailable: overlapLoser.body.availableSeatIds,
    storedClaims: winnerSeats,
    residual: 'the 23505 catch path is exercised only when both requests read before either writes',
  }

  // B5.2: an explicit guest write cancels the whole booking and releases every
  // claim in the same transaction. The token travels in a header, not the URL.
  const cancelReference = String(first.body.reference)
  const cancelResponse = await guestCancel(cancelReference, token, '203.0.113.30')
  assert.equal(cancelResponse.status, 200)
  const cancelBody = (await cancelResponse.json()) as Record<string, unknown>
  assert.equal(cancelBody.reference, cancelReference)
  assert.equal(cancelBody.status, 'cancelled')
  assert.equal(cancelBody.canCancel, false)
  assert.ok(!JSON.stringify(cancelBody).includes(token), 'the cancellation reflected the token')
  assert.equal(cancelResponse.headers.get('Cache-Control'), 'no-store')
  assert.equal(cancelResponse.headers.get('Referrer-Policy'), 'no-referrer')

  const [storedCancel] = await sql`
    SELECT status, cancelled_at FROM bookings WHERE reference = ${cancelReference}
  `
  assert.equal(storedCancel.status, 'cancelled')
  assert.ok(storedCancel.cancelled_at, 'cancelled_at was not recorded')
  const [released] = await sql`
    SELECT count(*)::int AS claims FROM booking_seats
    WHERE booking_id = (SELECT id FROM bookings WHERE reference = ${cancelReference})
  `
  assert.equal(Number(released.claims), 0)
  const mapResponse = await app.request(`/showtimes/${showtime.main}/seat-map`)
  assert.equal(mapResponse.status, 200)
  const map = (await mapResponse.json()) as { seats: Array<{ id: string; available: boolean }> }
  assert.equal(map.seats.find((seat) => seat.id === seats.a1)?.available, true)

  // A lost response can be retried: the second call reports the same state and
  // does not write again or send another email.
  const mailsBeforeRepeat = guestMails(idemEmail)
  const repeated = await guestCancel(cancelReference, token, '203.0.113.31')
  assert.equal(repeated.status, 200)
  const repeatedBody = await repeated.json()
  assert.deepEqual(repeatedBody, cancelBody)
  const [afterRepeat] = await sql`
    SELECT status, cancelled_at FROM bookings WHERE reference = ${cancelReference}
  `
  assert.equal(afterRepeat.status, 'cancelled')
  assert.equal(
    new Date(afterRepeat.cancelled_at).getTime(),
    new Date(storedCancel.cancelled_at).getTime(),
  )
  assert.equal(guestMails(idemEmail), mailsBeforeRepeat)

  // The two-hour cutoff is a closing instant: a booking made for a showtime
  // exactly two hours out is already too late to cancel when the write arrives.
  const cutoffEmail = 'b52-cutoff@example.com'
  const cutoffBooking = await confirm(
    { showtimeId: showtime.cancelClosed, seatIds: [seats.c1], customerEmail: cutoffEmail, quotedUnitPricePiastres: 2500 },
    randomUUID(),
    '203.0.113.32',
  )
  assert.equal(cutoffBooking.status, 201)
  const cutoffMail = getCapturedMessages().find(
    (message) => message.kind === 'guest-link' && message.to === cutoffEmail,
  )
  assert.ok(cutoffMail, 'the cutoff booking did not email a guest link')
  const cutoffLink = new URL(/(https?:\/\/[^\s]+)/.exec(cutoffMail.text)![1])
  const cutoffToken = cutoffLink.searchParams.get('token')!
  const refused = await guestCancel(String(cutoffBooking.body.reference), cutoffToken, '203.0.113.33')
  assert.equal(refused.status, 409)
  assert.deepEqual(await refused.json(), { error: 'cancellation_closed' })
  const [stillConfirmed] = await sql`
    SELECT status FROM bookings WHERE reference = ${cutoffBooking.body.reference}
  `
  assert.equal(stillConfirmed.status, 'confirmed')
  assert.deepEqual(await counts(showtime.cancelClosed), { bookings: 1, claims: 1 })

  const referenceOnlyCancel = await guestCancel(cancelReference, undefined, '203.0.113.34')
  assert.equal(referenceOnlyCancel.status, 404)
  assert.deepEqual(await referenceOnlyCancel.json(), { error: 'guest_link_invalid' })

  results.guestCancellation = {
    status: cancelResponse.status,
    storedStatus: storedCancel.status,
    claimsAfterCancel: Number(released.claims),
    seatAvailableAgain: map.seats.find((seat) => seat.id === seats.a1)?.available,
    repeatedStatus: repeated.status,
    repeatedBodyIdentical: JSON.stringify(repeatedBody) === JSON.stringify(cancelBody),
    cutoffStatus: refused.status,
    cutoffStoredStatus: stillConfirmed.status,
    referenceOnlyStatus: referenceOnlyCancel.status,
  }

  // B6.1: the new staff reads return a fixed, secret-free projection and an
  // occupancy count consistent with the claims just written by confirmation.
  const { cookie, actorId } = await staffSignInAs(staffEmail, staffPassword)
  const readReference = String(unquoted.body.reference)
  const anonymousList = await staffRead(`/staff/bookings?period=all&reference=${encodeURIComponent(readReference)}`)
  assert.equal(anonymousList.status, 401)
  assert.deepEqual(await anonymousList.json(), { error: 'authentication_required' })
  const readList = await staffRead(
    `/staff/bookings?period=all&reference=${encodeURIComponent(readReference)}&status=confirmed&page=1&pageSize=10`,
    cookie,
  )
  assert.equal(readList.status, 200)
  const listPage = (await readList.json()) as {
    items: Array<{ reference: string; filmTitle: string; seatCount: number; customerEmail: string }>
    total: number
    page: number
    pageSize: number
    pageCount: number
  }
  assert.equal(listPage.total, 1)
  assert.equal(listPage.items[0].reference, readReference)
  assert.equal(listPage.items[0].filmTitle, 'فيلم التحقق الحي')
  assert.equal(listPage.items[0].seatCount, 1)
  assert.equal(listPage.items[0].customerEmail, 'b46-price@example.com')
  assert.equal(listPage.page, 1)
  assert.equal(listPage.pageSize, 10)
  assert.equal(listPage.pageCount, 1)
  assert.ok(!JSON.stringify(listPage).includes('guestLink'), 'the staff list leaked a link field')

  const readDetail = await staffRead(`/staff/bookings/${String(unquoted.body.id)}`, cookie)
  assert.equal(readDetail.status, 200)
  const staffDetail = (await readDetail.json()) as {
    reference: string
    filmTitle: string
    seatLabels: string[]
    totalPiastres: number
    guestLinkSent: boolean
  }
  assert.equal(staffDetail.reference, readReference)
  assert.equal(staffDetail.filmTitle, 'فيلم التحقق الحي')
  assert.ok(Array.isArray(staffDetail.seatLabels))
  assert.equal(staffDetail.totalPiastres, 3000)
  assert.equal(staffDetail.guestLinkSent, true)
  assert.ok(!JSON.stringify(staffDetail).includes('verifier'))
  assert.ok(!JSON.stringify(staffDetail).includes('guestLinkEncrypted'))

  const readOccupancy = await staffRead(`/staff/showtimes/${showtime.price}/occupancy`, cookie)
  assert.equal(readOccupancy.status, 200)
  const occupancyView = (await readOccupancy.json()) as {
    showtimeId: string
    totalSeats: number
    outOfServiceSeats: number
    bookedSeats: number
    availableSeats: number
    occupancyPercent: number
  }
  assert.equal(occupancyView.showtimeId, showtime.price)
  assert.equal(occupancyView.totalSeats, 2)
  assert.equal(occupancyView.outOfServiceSeats, 0)
  assert.equal(occupancyView.bookedSeats, 1)
  assert.equal(occupancyView.availableSeats, 1)
  assert.equal(occupancyView.occupancyPercent, 50)
  const missingDetail = await staffRead(`/staff/bookings/${randomUUID()}`, cookie)
  assert.equal(missingDetail.status, 404)
  assert.deepEqual(await missingDetail.json(), { error: 'booking_not_found' })
  results.staffBookingReads = {
    anonymousListStatus: anonymousList.status,
    listTotal: listPage.total,
    detailStatus: readDetail.status,
    detailReferenceMatches: staffDetail.reference === readReference,
    occupancy: occupancyView,
    missingDetailStatus: missingDetail.status,
  }

  // B5.3: staff cancel on the guest's request before the showtime starts,
  // with a required reason and the acting staff id stored on the booking.
  const staffGuestEmail = 'b53-staff@example.com'
  const staffBooking = await confirm(
    {
      showtimeId: showtime.main,
      seatIds: [seats.a5],
      customerEmail: staffGuestEmail,
      quotedUnitPricePiastres: 2500,
    },
    randomUUID(),
    '203.0.113.42',
  )
  assert.equal(staffBooking.status, 201, JSON.stringify(staffBooking.body))
  const staffBookingId = String(staffBooking.body.id)
  const staffReason = 'Guest called the cinema to cancel'

  const anonymous = await staffCancel(staffBookingId, staffReason)
  assert.equal(anonymous.status, 401)
  assert.deepEqual(await anonymous.json(), { error: 'authentication_required' })
  const blankReason = await staffCancel(staffBookingId, '   ', cookie)
  assert.equal(blankReason.status, 400)
  const [beforeStaff] = await sql`SELECT status FROM bookings WHERE id = ${staffBookingId}`
  assert.equal(beforeStaff.status, 'confirmed')

  const staffResponse = await staffCancel(staffBookingId, staffReason, cookie)
  assert.equal(staffResponse.status, 200, await staffResponse.clone().text())
  const staffBody = (await staffResponse.json()) as Record<string, unknown>
  assert.equal(staffBody.reference, staffBooking.body.reference)
  assert.equal(staffBody.status, 'cancelled')
  assert.equal(staffBody.cancelledByUserId, actorId)
  assert.equal(staffBody.cancellationReason, staffReason)
  assert.ok(staffBody.cancelledAt, 'the response has no cancellation timestamp')

  const [storedStaff] = await sql`
    SELECT status, cancelled_at, cancelled_by_user_id, cancellation_reason
    FROM bookings WHERE id = ${staffBookingId}
  `
  assert.equal(storedStaff.status, 'cancelled')
  assert.equal(storedStaff.cancelled_by_user_id, actorId)
  assert.equal(storedStaff.cancellation_reason, staffReason)
  assert.ok(storedStaff.cancelled_at, 'cancelled_at was not stored')
  const expectedStaffResponse = JSON.stringify({
    id: staffBookingId,
    reference: staffBooking.body.reference,
    status: 'cancelled',
    // Neon renders timestamptz as "YYYY-MM-DD HH:mm:ss.sss+00"; compare the
    // instant, not the driver's textual representation.
    cancelledAt: new Date(storedStaff.cancelled_at).toISOString(),
    cancelledByUserId: storedStaff.cancelled_by_user_id,
    cancellationReason: storedStaff.cancellation_reason,
  })
  assert.equal(
    JSON.stringify(staffBody),
    expectedStaffResponse,
    'the response did not match the committed cancellation row',
  )
  assert.equal(Object.keys(staffBody).length, 6, 'the response has extra fields')
  const [staffClaims] = await sql`
    SELECT count(*)::int AS claims FROM booking_seats WHERE booking_id = ${staffBookingId}
  `
  assert.equal(Number(staffClaims.claims), 0)
  const mapAfterStaff = await app.request(`/showtimes/${showtime.main}/seat-map`)
  assert.equal(mapAfterStaff.status, 200)
  const staffMap = (await mapAfterStaff.json()) as {
    seats: Array<{ id: string; available: boolean }>
  }
  assert.equal(staffMap.seats.find((seat) => seat.id === seats.a5)?.available, true)

  // A lost response is retried safely: the original actor, reason and time are
  // returned byte-identically even if the retry supplies a different reason.
  const repeatedStaff = await staffCancel(staffBookingId, 'A different reason', cookie)
  assert.equal(repeatedStaff.status, 200)
  const repeatedStaffBody = await repeatedStaff.json()
  assert.deepEqual(repeatedStaffBody, staffBody)
  const [afterStaffRepeat] = await sql`
    SELECT cancelled_at, cancelled_by_user_id, cancellation_reason
    FROM bookings WHERE id = ${staffBookingId}
  `
  assert.equal(
    new Date(afterStaffRepeat.cancelled_at).getTime(),
    new Date(storedStaff.cancelled_at).getTime(),
  )
  assert.equal(afterStaffRepeat.cancelled_by_user_id, actorId)
  assert.equal(afterStaffRepeat.cancellation_reason, staffReason)
  assert.equal(guestMails(staffGuestEmail), 1)

  // The cutoff is the showtime start, not the two-hour guest boundary. A
  // started showtime cannot be cancelled by staff through this route.
  const pastBookingId = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'
  const pastReference = `bkg_${'e'.repeat(32)}`
  const pastStart = startsAt[showtime.staffPast]
  await sql`
    INSERT INTO bookings
      (id, customer_name, customer_email, starts_at, reference, showtime_id, idempotency_response)
    VALUES (
      ${pastBookingId}, 'b53-past@example.com', 'b53-past@example.com', ${pastStart},
      ${pastReference}, ${showtime.staffPast},
      ${JSON.stringify({
        id: pastBookingId,
        reference: pastReference,
        showtimeId: showtime.staffPast,
        filmTitle: 'فيلم التحقق الحي',
        startsAt: pastStart,
        auditoriumName: 'B4.6 Screen C',
        seatLabels: ['C1'],
        seatIds: [seats.c1],
        unitPricePiastres: 2500,
        totalPiastres: 2500,
      })}::jsonb
    )
  `
  const started = await staffCancel(pastBookingId, staffReason, cookie)
  assert.equal(started.status, 409)
  assert.deepEqual(await started.json(), { error: 'showtime_started' })
  const [pastStored] = await sql`
    SELECT status, cancelled_at FROM bookings WHERE id = ${pastBookingId}
  `
  assert.equal(pastStored.status, 'confirmed')
  assert.equal(pastStored.cancelled_at, null)

  // Two concurrent staff cancellations: exactly one actor/reason is stored and
  // both callers see the same cancelled outcome.
  const raceEmail = 'b53-race@example.com'
  const raceBooking = await confirm(
    {
      showtimeId: showtime.main,
      seatIds: [seats.a1],
      customerEmail: raceEmail,
      quotedUnitPricePiastres: 2500,
    },
    randomUUID(),
    '203.0.113.43',
  )
  assert.equal(raceBooking.status, 201, JSON.stringify(raceBooking.body))
  const raceId = String(raceBooking.body.id)
  const { cookie: opsCookie, actorId: opsActorId } = await ensureOperationsStaff()
  const [raceA, raceB] = await Promise.all([
    staffCancel(raceId, 'First staff reason', cookie),
    staffCancel(raceId, 'Second staff reason', opsCookie),
  ])
  assert.equal(raceA.status, 200)
  assert.equal(raceB.status, 200)
  assert.deepEqual(await raceB.json(), await raceA.clone().json())
  const [raceStored] = await sql`
    SELECT cancelled_by_user_id, cancellation_reason FROM bookings WHERE id = ${raceId}
  `
  assert.ok(['First staff reason', 'Second staff reason'].includes(raceStored.cancellation_reason))
  assert.equal(
    raceStored.cancelled_by_user_id,
    raceStored.cancellation_reason === 'First staff reason' ? actorId : opsActorId,
    'the losing staff member overwrote the winner actor',
  )
  const [raceClaims] = await sql`
    SELECT count(*)::int AS claims FROM booking_seats WHERE booking_id = ${raceId}
  `
  assert.equal(Number(raceClaims.claims), 0)
  results.staffCancellation = {
    anonymousStatus: anonymous.status,
    blankReasonStatus: blankReason.status,
    status: staffResponse.status,
    storedStatus: storedStaff.status,
    storedActorMatchesStaff: storedStaff.cancelled_by_user_id === actorId,
    storedReason: storedStaff.cancellation_reason,
    responseMatchesStoredRow: JSON.stringify(staffBody) === expectedStaffResponse,
    fixedFieldCount: Object.keys(staffBody).length,
    credentialFieldsAbsent:
      !('token' in staffBody) && !('guestLinkVerifier' in staffBody) && !('customerEmail' in staffBody),
    claimsAfterCancel: Number(staffClaims.claims),
    seatAvailableAgain: staffMap.seats.find((seat) => seat.id === seats.a5)?.available,
    repeatedBodyIdentical: JSON.stringify(repeatedStaffBody) === JSON.stringify(staffBody),
    startedStatus: started.status,
    startedStoredStatus: pastStored.status,
    raceStatuses: [raceA.status, raceB.status],
    raceStoredReason: raceStored.cancellation_reason,
    raceActorMatchesWinner: true,
    raceClaimsAfter: Number(raceClaims.claims),
  }

  // B5.4: an admin cancels an upcoming showtime with a reason. The status
  // change, the cancellation of every active booking and the release of every
  // claim happen in one Neon transaction; booking history is never deleted.
  const adminReason = 'Hall closed for maintenance'
  const adminGuestEmail = 'b54-main@example.com'
  const adminKey = randomUUID()
  const adminPayload = {
    showtimeId: showtime.adminCancel,
    seatIds: [seats.b1],
    customerEmail: adminGuestEmail,
    quotedUnitPricePiastres: 2500,
  }
  const adminBooking = await confirm(adminPayload, adminKey, '203.0.113.45')
  assert.equal(adminBooking.status, 201, JSON.stringify(adminBooking.body))
  const mailsBeforeAdminCancel = guestMails(adminGuestEmail)

  const anonCancelShowtime = await adminCancelShowtime(showtime.adminCancel, adminReason)
  assert.equal(anonCancelShowtime.status, 401)
  assert.deepEqual(await anonCancelShowtime.json(), { error: 'authentication_required' })
  const opsCancelShowtime = await adminCancelShowtime(showtime.adminCancel, adminReason, opsCookie)
  assert.equal(opsCancelShowtime.status, 403)
  assert.deepEqual(await opsCancelShowtime.json(), { error: 'forbidden' })
  const blankShowtimeReason = await adminCancelShowtime(showtime.adminCancel, '   ', cookie)
  assert.equal(blankShowtimeReason.status, 400)
  const [stillPublished] = await sql`SELECT status FROM showtimes WHERE id = ${showtime.adminCancel}`
  assert.equal(stillPublished.status, 'published')

  const cancelledShowtime = await adminCancelShowtime(showtime.adminCancel, adminReason, cookie)
  assert.equal(cancelledShowtime.status, 200, await cancelledShowtime.clone().text())
  const adminBody = (await cancelledShowtime.json()) as Record<string, unknown>
  assert.equal(adminBody.id, showtime.adminCancel)
  assert.equal(adminBody.status, 'cancelled')
  assert.equal(adminBody.cancelledByUserId, actorId)
  assert.equal(adminBody.cancellationReason, adminReason)
  assert.ok(adminBody.cancelledAt)
  assert.equal(Object.keys(adminBody).length, 5)

  const [storedShowtimeRow] = await sql`
    SELECT status, cancelled_at, cancelled_by_user_id, cancellation_reason
    FROM showtimes WHERE id = ${showtime.adminCancel}
  `
  assert.equal(storedShowtimeRow.status, 'cancelled')
  assert.equal(storedShowtimeRow.cancelled_by_user_id, actorId)
  assert.equal(storedShowtimeRow.cancellation_reason, adminReason)
  const [storedAdminBooking] = await sql`
    SELECT status, cancelled_at, cancelled_by_user_id, cancellation_reason, idempotency_response
    FROM bookings WHERE id = ${adminBooking.body.id}
  `
  assert.equal(storedAdminBooking.status, 'cancelled')
  assert.equal(storedAdminBooking.cancelled_by_user_id, actorId)
  assert.equal(storedAdminBooking.cancellation_reason, adminReason)
  assert.equal(
    new Date(storedAdminBooking.cancelled_at).getTime(),
    new Date(storedShowtimeRow.cancelled_at).getTime(),
  )
  assert.ok(storedAdminBooking.idempotency_response, 'the frozen booking history was not preserved')
  assert.deepEqual(await counts(showtime.adminCancel), { bookings: 1, claims: 0 })
  const cancelledPublicRead = await app.request(`/showtimes/${showtime.adminCancel}`)
  assert.equal(cancelledPublicRead.status, 404, 'a cancelled showtime is still publicly readable')
  assert.equal(guestMails(adminGuestEmail), mailsBeforeAdminCancel, 'the cancellation sent email')

  // A lost response can be retried with a different reason without rewriting.
  const repeatedShowtime = await adminCancelShowtime(
    showtime.adminCancel,
    'A different reason',
    cookie,
  )
  assert.equal(repeatedShowtime.status, 200)
  const repeatedShowtimeBody = await repeatedShowtime.json()
  assert.deepEqual(repeatedShowtimeBody, adminBody)
  const [afterRepeatShowtime] = await sql`
    SELECT cancelled_at, cancellation_reason FROM showtimes WHERE id = ${showtime.adminCancel}
  `
  assert.equal(afterRepeatShowtime.cancellation_reason, adminReason)
  assert.equal(
    new Date(afterRepeatShowtime.cancelled_at).getTime(),
    new Date(storedShowtimeRow.cancelled_at).getTime(),
  )

  // New bookings are refused with the generic public denial, with no write.
  const blockedConfirm = await confirm(
    {
      showtimeId: showtime.adminCancel,
      seatIds: [seats.b2],
      customerEmail: 'b54-blocked@example.com',
      quotedUnitPricePiastres: 2500,
    },
    randomUUID(),
    '203.0.113.46',
  )
  assert.equal(blockedConfirm.status, 404)
  assert.deepEqual(blockedConfirm.body, { error: 'showtime_not_found' })
  assert.deepEqual(await counts(showtime.adminCancel), { bookings: 1, claims: 0 })
  assert.equal(guestMails('b54-blocked@example.com'), 0)

  // A fresh key is denied, but the original key still replays the frozen 201:
  // D4 replay is unchanged by a later cancellation, and sends no second email.
  const replayAfterCancel = await confirm(adminPayload, adminKey, '203.0.113.48')
  assert.equal(replayAfterCancel.status, 201)
  assert.equal(JSON.stringify(replayAfterCancel.body), JSON.stringify(adminBooking.body))
  assert.equal(guestMails(adminGuestEmail), mailsBeforeAdminCancel)

  // The invariant also survives a caller that bypasses the route: Postgres
  // refuses a booking insert for a cancelled showtime.
  const directId = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'
  let triggerCode: string | null = null
  let triggerMarker = ''
  let insertedDirectly = false
  try {
    await sql`
      INSERT INTO bookings (id, customer_name, customer_email, starts_at, reference, showtime_id)
      VALUES (
        ${directId}, 'b54-direct@example.com', 'b54-direct@example.com',
        ${startsAt[showtime.adminCancel]}, ${`bkg_${'d'.repeat(32)}`}, ${showtime.adminCancel}
      )
    `
    insertedDirectly = true
  } catch (error) {
    const raised = error as { code?: string; constraint?: string; message?: string }
    triggerCode = raised.code ?? null
    triggerMarker = `${raised.constraint ?? ''} ${raised.message ?? ''}`
  }
  assert.equal(insertedDirectly, false, 'the trigger allowed a booking for a cancelled showtime')
  assert.equal(triggerCode, 'P0001')
  assert.ok(triggerMarker.includes('showtimes_booking_requires_published'), triggerMarker)

  // Only upcoming showtimes can be cancelled; the start instant is too late.
  const startedShowtime = await adminCancelShowtime(showtime.adminCancelPast, adminReason, cookie)
  assert.equal(startedShowtime.status, 409)
  assert.deepEqual(await startedShowtime.json(), { error: 'showtime_started' })
  const [pastShowtimeStored] = await sql`
    SELECT status, cancelled_at FROM showtimes WHERE id = ${showtime.adminCancelPast}
  `
  assert.equal(pastShowtimeStored.status, 'published')
  assert.equal(pastShowtimeStored.cancelled_at, null)

  // A confirmation racing the cancellation cannot leave an active booking:
  // whichever write wins, the final state has no confirmed booking or claim.
  const [raceConfirm, raceCancel] = await Promise.all([
    confirm(
      {
        showtimeId: showtime.adminCancelRace,
        seatIds: [seats.b1],
        customerEmail: 'b54-race@example.com',
        quotedUnitPricePiastres: 2500,
      },
      randomUUID(),
      '203.0.113.47',
    ),
    adminCancelShowtime(showtime.adminCancelRace, adminReason, cookie),
  ])
  assert.ok([201, 404].includes(raceConfirm.status), JSON.stringify(raceConfirm.body))
  assert.equal(raceCancel.status, 200, await raceCancel.clone().text())
  const [raceShowtimeRow] = await sql`
    SELECT status FROM showtimes WHERE id = ${showtime.adminCancelRace}
  `
  assert.equal(raceShowtimeRow.status, 'cancelled')
  const [activeForCancelled] = await sql`
    SELECT count(*)::int AS n FROM bookings
    WHERE showtime_id = ${showtime.adminCancelRace} AND status = 'confirmed'
  `
  assert.equal(Number(activeForCancelled.n), 0, 'a racing confirmation left an active booking')
  assert.deepEqual(await counts(showtime.adminCancelRace), {
    bookings: raceConfirm.status === 201 ? 1 : 0,
    claims: 0,
  })

  // Two admins with different reasons race on one showtime. The status CAS
  // lets one win; both callers report its stored outcome byte-identically.
  const { cookie: secondAdminCookie, actorId: secondAdminId } = await ensureSecondAdmin()
  const [adminRaceA, adminRaceB] = await Promise.all([
    adminCancelShowtime(showtime.adminCancelAdmins, 'First admin reason', cookie),
    adminCancelShowtime(showtime.adminCancelAdmins, 'Second admin reason', secondAdminCookie),
  ])
  assert.equal(adminRaceA.status, 200, await adminRaceA.clone().text())
  assert.equal(adminRaceB.status, 200, await adminRaceB.clone().text())
  const adminRaceBodyA = await adminRaceA.json()
  assert.deepEqual(await adminRaceB.json(), adminRaceBodyA)
  const [adminRaceStored] = await sql`
    SELECT status, cancelled_by_user_id, cancellation_reason, cancelled_at
    FROM showtimes WHERE id = ${showtime.adminCancelAdmins}
  `
  assert.equal(adminRaceStored.status, 'cancelled')
  assert.ok(['First admin reason', 'Second admin reason'].includes(adminRaceStored.cancellation_reason))
  assert.equal(
    adminRaceStored.cancelled_by_user_id,
    adminRaceStored.cancellation_reason === 'First admin reason' ? actorId : secondAdminId,
    'the losing admin overwrote the winner actor',
  )
  assert.equal(adminRaceBodyA.cancelledByUserId, adminRaceStored.cancelled_by_user_id)
  assert.equal(adminRaceBodyA.cancellationReason, adminRaceStored.cancellation_reason)
  assert.equal(
    new Date(adminRaceBodyA.cancelledAt).getTime(),
    new Date(adminRaceStored.cancelled_at).getTime(),
  )

  results.adminShowtimeCancellation = {
    anonymousStatus: anonCancelShowtime.status,
    operationsStatus: opsCancelShowtime.status,
    blankReasonStatus: blankShowtimeReason.status,
    status: cancelledShowtime.status,
    responseFieldCount: Object.keys(adminBody).length,
    storedActorMatchesAdmin: storedShowtimeRow.cancelled_by_user_id === actorId,
    storedReason: storedShowtimeRow.cancellation_reason,
    bookingCancelledWithSameActorAndInstant: true,
    bookingHistoryPreserved: Boolean(storedAdminBooking.idempotency_response),
    claimsAfterCancel: 0,
    publicReadStatus: cancelledPublicRead.status,
    repeatedBodyIdentical: JSON.stringify(repeatedShowtimeBody) === JSON.stringify(adminBody),
    blockedConfirmStatus: blockedConfirm.status,
    replayAfterCancelStatus: replayAfterCancel.status,
    replayAfterCancelIdentical:
      JSON.stringify(replayAfterCancel.body) === JSON.stringify(adminBooking.body),
    competingAdminStatuses: [adminRaceA.status, adminRaceB.status],
    competingAdminStoredReason: adminRaceStored.cancellation_reason,
    competingAdminActorMatchesWinner: true,
    triggerCode,
    triggerMarkerPresent: triggerMarker.includes('showtimes_booking_requires_published'),
    startedStatus: startedShowtime.status,
    startedStoredStatus: pastShowtimeStored.status,
    raceConfirmStatus: raceConfirm.status,
    raceCancelStatus: raceCancel.status,
    raceActiveBookings: Number(activeForCancelled.n),
  }
} finally {
  await cleanup()
  clearCapturedMessages()
}

const prototypeAfter = await sql`
  SELECT
    (SELECT count(*)::int FROM services) AS services,
    (SELECT count(*)::int FROM bookings) AS bookings
`
assert.deepEqual(prototypeAfter, prototypeBefore, 'prototype rows changed during the rehearsal')

// B5.3 migration 0010 and B5.4 migrations 0011/0012 must exist on the isolated
// database before the cancellation writes above can be trusted. No credential
// is printed here either.
const migrationColumns = await sql`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE
    (table_name = 'bookings' AND column_name IN ('cancelled_by_user_id', 'cancellation_reason'))
    OR (table_name = 'showtimes' AND column_name IN ('cancelled_at', 'cancelled_by_user_id', 'cancellation_reason'))
`
assert.equal(migrationColumns.length, 5, 'cancellation columns from 0010/0011 are missing')
const triggers = await sql`
  SELECT trigger_name FROM information_schema.triggers
  WHERE event_object_table = 'bookings' AND trigger_name = 'bookings_require_published_showtime'
`
assert.equal(triggers.length, 1, 'migration 0012 booking trigger is missing')

console.log(
  JSON.stringify(
    {
      targetDatabase: 'booking_system_test',
      migrationColumns: migrationColumns
        .map((row) => `${row.table_name}.${row.column_name}`)
        .sort(),
      triggers: triggers.map((row) => String(row.trigger_name)),
      results,
      prototypeRows: { before: prototypeBefore, after: prototypeAfter },
      fixtureRemoved: true,
    },
    null,
    2,
  ),
)
