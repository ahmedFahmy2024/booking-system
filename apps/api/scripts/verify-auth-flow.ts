import 'dotenv/config'
import assert from 'node:assert/strict'
import { and, desc, eq, like, ne, sql } from 'drizzle-orm'
import { app } from '../src/app.js'
import { getDb } from '../src/db/index.js'
import { user, verification } from '../src/db/auth-schema.js'
import {
  clearCapturedMessages,
  getCapturedMessages,
} from '../src/features/mail/index.js'

// Live check for B2.2: run against an isolated Neon database after migrations
// and npm run admin:bootstrap. No credentials are printed.
const adminEmail = process.env.VERIFY_ADMIN_EMAIL
const adminPassword = process.env.VERIFY_ADMIN_PASSWORD
if (!adminEmail || !adminPassword) {
  throw new Error('Set VERIFY_ADMIN_EMAIL and VERIFY_ADMIN_PASSWORD for the live auth check.')
}

const origin = process.env.APP_URL ?? 'http://localhost:3000'
const headers = {
  'Content-Type': 'application/json',
  Origin: origin,
  'x-forwarded-for': '127.0.0.1',
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/)
  assert.ok(match, 'expected a session cookie')
  return `better-auth.session_token=${match[1]}`
}

async function post(path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: 'POST',
    headers: cookie ? { ...headers, Cookie: cookie } : headers,
    body: JSON.stringify(body),
  })
}

async function run() {
  // This script is destructive to staff state: restrict it to the isolated DB.
  const database = new URL(process.env.DATABASE_URL ?? '').pathname
  assert.equal(database, '/booking_system_test', 'use the isolated test database')

  const [bootstrap] = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, adminEmail))
    .limit(1)
  assert.ok(bootstrap, 'bootstrap admin is missing')
  await getDb()
    .update(user)
    .set({ banned: false, banReason: null })
    .where(eq(user.id, bootstrap.id))
  await getDb()
    .update(user)
    .set({ banned: true, banReason: 'reset by auth verification' })
    .where(and(eq(user.role, 'admin'), ne(user.id, bootstrap.id)))

  const adminSignIn = await post('/api/auth/sign-in/email', {
    email: adminEmail,
    password: adminPassword,
  })
  assert.equal(adminSignIn.status, 200, await adminSignIn.clone().text())
  const adminCookie = sessionCookie(adminSignIn)

  const staffList = await app.request('/staff', { headers: { Cookie: adminCookie } })
  assert.equal(staffList.status, 200)

  clearCapturedMessages()
  const staffEmail = `verify-staff-${Date.now()}@example.com`
  const invited = await post(
    '/staff/invite',
    { name: 'Verification Staff', email: staffEmail, role: 'operations' },
    adminCookie,
  )
  assert.equal(invited.status, 201, await invited.clone().text())
  const { id: staffId } = (await invited.json()) as { id: string }

  const messages = getCapturedMessages()
  assert.equal(messages.length, 1, 'expected one invitation email')
  const link = messages[0].text.match(/https?:\/\/\S+/)?.[0]
  assert.ok(link?.includes('/reset-password/'), 'expected a password setup link')
  const token = new URL(link).pathname.split('/').filter(Boolean).pop()
  assert.ok(token, 'expected a reset token')

  const [issued] = await getDb()
    .select({ expiresAt: verification.expiresAt })
    .from(verification)
    .where(like(verification.identifier, 'reset-password:%'))
    .orderBy(desc(verification.createdAt))
    .limit(1)
  assert.ok(issued, 'expected a stored verification token')
  const ttlHours = (issued.expiresAt.getTime() - Date.now()) / 3_600_000
  assert.ok(ttlHours > 23.9 && ttlHours <= 24.01, `unexpected invitation TTL: ${ttlHours}`)

  const newPassword = 'VerifiedStaffPass123!'
  const reset = await post('/api/auth/reset-password', { token, newPassword })
  assert.equal(reset.status, 200, await reset.clone().text())

  const staffSignIn = await post('/api/auth/sign-in/email', {
    email: staffEmail,
    password: newPassword,
  })
  assert.equal(staffSignIn.status, 200, await staffSignIn.clone().text())
  const staffCookie = sessionCookie(staffSignIn)

  const operationsDenied = await app.request('/staff', { headers: { Cookie: staffCookie } })
  assert.equal(operationsDenied.status, 403)

  const deactivated = await app.request(`/staff/${staffId}/deactivate`, {
    method: 'POST',
    headers: { Cookie: adminCookie },
  })
  assert.equal(deactivated.status, 200, await deactivated.clone().text())

  const bannedDenied = await app.request('/staff', { headers: { Cookie: staffCookie } })
  assert.ok(
    bannedDenied.status === 401 || bannedDenied.status === 403,
    `a deactivated account must not keep access (got ${bannedDenied.status})`,
  )

  const signedOut = await post('/api/auth/sign-out', {}, staffCookie)
  assert.equal(signedOut.status, 200, await signedOut.clone().text())

  const afterSignOut = await app.request('/staff', { headers: { Cookie: staffCookie } })
  assert.equal(afterSignOut.status, 401)

  // Storage-boundary invariant: the last active admin cannot be removed.
  let storageGuardBlocked = false
  try {
    await getDb().update(user).set({ banned: true }).where(eq(user.id, bootstrap.id))
  } catch (error) {
    let current: unknown = error
    while (current instanceof Error) {
      if (current.message.includes('last_active_admin')) {
        storageGuardBlocked = true
        break
      }
      current = current.cause
    }
  }
  assert.ok(storageGuardBlocked, 'the storage guard must protect the last active admin')

  // Two admins racing to deactivate each other must leave exactly one admin.
  const reactivated = await app.request(`/staff/${staffId}/reactivate`, {
    method: 'POST',
    headers: { Cookie: adminCookie },
  })
  assert.equal(reactivated.status, 200, await reactivated.clone().text())
  const promoted = await app.request(`/staff/${staffId}/role`, {
    method: 'PATCH',
    headers: { ...headers, Cookie: adminCookie },
    body: JSON.stringify({ role: 'admin' }),
  })
  assert.equal(promoted.status, 200, await promoted.clone().text())

  const secondAdminSignIn = await post('/api/auth/sign-in/email', {
    email: staffEmail,
    password: newPassword,
  })
  assert.equal(secondAdminSignIn.status, 200, await secondAdminSignIn.clone().text())
  const secondAdminCookie = sessionCookie(secondAdminSignIn)

  const activeAdminCount = async () => {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.role, 'admin'), eq(user.banned, false)))
    return row.count
  }

  const beforeRace = await activeAdminCount()
  const raceResults = await Promise.all([
    app.request(`/staff/${staffId}/deactivate`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    }),
    app.request(`/staff/${bootstrap.id}/deactivate`, {
      method: 'POST',
      headers: { Cookie: secondAdminCookie },
    }),
  ])
  const afterRace = await activeAdminCount()
  assert.equal(
    afterRace,
    beforeRace - 1,
    `a deactivation race must remove exactly one admin (statuses: ${raceResults.map((r) => r.status).join(',')})`,
  )

  // Keep the bootstrap admin usable so this check can be repeated.
  await getDb()
    .update(user)
    .set({ banned: false, banReason: null })
    .where(eq(user.id, bootstrap.id))

  console.log(
    'Live auth flow passed: sign-in, invite TTL 24h, reset, role guard, deactivation, sign-out, last-admin guard, concurrent deactivation',
  )
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
