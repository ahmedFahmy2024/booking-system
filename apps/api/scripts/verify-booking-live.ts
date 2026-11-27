import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { app } from '../src/app.js'
import { clearCapturedMessages, getCapturedMessages } from '../src/features/mail/index.js'
import { bookingCutoffAt, isBookingClosed } from '../src/features/showtimes/schedule.js'

/**
 * B4.6 live rehearsal on the isolated database. Drives the real confirmation
 * route with real Neon writes: competing seat claims, a multi-seat conflict,
 * the booking cutoff, concurrent idempotency replay and the price window.
 * The fixture uses fixed IDs, is removed before and after the run, and never
 * touches prototype rows, credentials or production data. Run with
 * `npm run verify:booking-live`, which loads `.env.test` first.
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
      id === showtime.cancelClosed ? auditoriumC : id === showtime.main || id === showtime.race || id === showtime.closed ? auditoriumA : auditoriumB
    const auditoriumName =
      id === showtime.cancelClosed ? 'B4.6 Screen C' : targetAuditorium === auditoriumA ? 'B4.6 Screen A' : 'B4.6 Screen B'
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

console.log(
  JSON.stringify(
    {
      targetDatabase: 'booking_system_test',
      results,
      prototypeRows: { before: prototypeBefore, after: prototypeAfter },
      fixtureRemoved: true,
    },
    null,
    2,
  ),
)
