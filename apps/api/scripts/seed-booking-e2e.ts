import assert from 'node:assert/strict'

/**
 * B4.6 Playwright prerequisite: ensure one active admin in the isolated
 * database so the browser scenario can create its own film, auditorium and
 * showtime through the real admin API. Run via `npm run seed:booking-e2e`,
 * which loads `.env.test` before the auth module opens the database. The
 * password is for this isolated database only; no credential is printed.
 */

const target = new URL(process.env.DATABASE_URL ?? '')
const pooled = target.hostname.includes('-pooler')
if (target.pathname !== '/booking_system_test' || !pooled) {
  throw new Error(
    `Refusing to seed: expected the pooled isolated booking_system_test database, got ${target.pathname} (pooled: ${pooled})`,
  )
}

const email = 'b46-e2e-admin@example.com'
const password = 'B46E2EPass123!'

const { eq } = await import('drizzle-orm')
const { auth } = await import('../src/auth.js')
const { getDb } = await import('../src/db/index.js')
const { user } = await import('../src/db/auth-schema.js')

const db = getDb()
const [existing] = await db
  .select({ id: user.id, role: user.role, banned: user.banned })
  .from(user)
  .where(eq(user.email, email))
  .limit(1)

if (existing) {
  if (existing.banned || existing.role !== 'admin') {
    await db
      .update(user)
      .set({
        ...(existing.banned ? { banned: false, banReason: null } : {}),
        ...(existing.role !== 'admin' ? { role: 'admin' } : {}),
      })
      .where(eq(user.id, existing.id))
  }
} else {
  await auth.api.createUser({
    body: { email, password, name: 'B4.6 E2E Admin', role: 'admin' },
  })
}

const [ready] = await db
  .select({ role: user.role, banned: user.banned })
  .from(user)
  .where(eq(user.email, email))
  .limit(1)
assert.equal(ready?.role, 'admin')
assert.equal(ready?.banned, false)

console.log(JSON.stringify({ targetDatabase: 'booking_system_test', admin: 'ready' }))
