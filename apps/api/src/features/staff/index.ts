import { zValidator } from '@hono/zod-validator'
import { randomBytes } from 'node:crypto'
import { and, eq, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { invitationPath } from '../../auth/config.js'
import { auth, webUrl } from '../../auth.js'
import type { AuthEnv } from '../../auth/middleware.js'
import { requireAdmin } from '../../auth/middleware.js'
import { getDb } from '../../db/index.js'
import { user } from '../../db/auth-schema.js'

export const staffRoutes = new Hono<AuthEnv>()

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(['admin', 'operations']),
})

const roleSchema = z.object({
  role: z.enum(['admin', 'operations']),
})

export type StaffInviteInput = z.infer<typeof inviteSchema>
export type StaffRoleInput = z.infer<typeof roleSchema>

function isLastAdminError(error: unknown): boolean {
  // Drizzle wraps the driver error, so walk the cause chain.
  let current: unknown = error
  while (current instanceof Error) {
    if (current.message.includes('last_active_admin')) {
      return true
    }
    current = current.cause
  }
  return false
}

// Count active admins other than the row being changed. The correlated
// subquery stays in the same UPDATE statement; the Postgres trigger in
// 0002_enforce_last_active_admin.sql covers concurrent statements.
const isNotLastActiveAdmin = sql`not (
  ${user.role} = 'admin'
  and coalesce(${user.banned}, false) = false
  and (select count(*) from "user" as other_admin
       where other_admin.role = 'admin'
         and coalesce(other_admin.banned, false) = false
         and other_admin.id <> ${user.id}) < 1
)`

staffRoutes.get('/', requireAdmin, async (c) => {
  const result = await auth.api.listUsers({
    headers: c.req.raw.headers,
    query: { limit: 100 },
  })

  return c.json(result.users)
})

staffRoutes.post('/invite', requireAdmin, zValidator('json', inviteSchema), async (c) => {
  const input = c.req.valid('json')
  const headers = c.req.raw.headers
  // A throwaway credential: the invited staff member sets their own password
  // through the single-use, 24-hour link sent below.
  const temporaryPassword = `Aa1!${randomBytes(24).toString('base64url')}`

  const created = await auth.api.createUser({
    headers,
    body: {
      name: input.name,
      email: input.email,
      password: temporaryPassword,
      role: input.role,
    },
  })

  await auth.api.requestPasswordReset({
    body: {
      email: input.email,
      redirectTo: `${webUrl}${invitationPath}`,
    },
  })

  return c.json({ id: created.user.id, email: input.email, role: input.role }, 201)
})

staffRoutes.patch('/:id/role', requireAdmin, zValidator('json', roleSchema), async (c) => {
  const actorId = c.get('session')!.user.id
  const targetId = c.req.param('id')
  const { role } = c.req.valid('json')

  let updated: { id: string }[]
  try {
    updated = await getDb()
      .update(user)
      .set({ role })
      .where(and(eq(user.id, targetId), ne(user.id, actorId), isNotLastActiveAdmin))
      .returning({ id: user.id })
  } catch (error) {
    if (isLastAdminError(error)) {
      return c.json({ error: 'staff_role_change_not_allowed' }, 409)
    }
    throw error
  }

  if (updated.length === 0) {
    return c.json({ error: 'staff_role_change_not_allowed' }, 409)
  }

  return c.json({ id: targetId, role })
})

staffRoutes.post('/:id/deactivate', requireAdmin, async (c) => {
  const actorId = c.get('session')!.user.id
  const targetId = c.req.param('id')
  const reason = `Deactivated by ${actorId} at ${new Date().toISOString()}`

  let updated: { id: string }[]
  try {
    updated = await getDb()
      .update(user)
      .set({ banned: true, banReason: reason })
      .where(and(eq(user.id, targetId), ne(user.id, actorId), isNotLastActiveAdmin))
      .returning({ id: user.id })
  } catch (error) {
    if (isLastAdminError(error)) {
      return c.json({ error: 'staff_deactivation_not_allowed' }, 409)
    }
    throw error
  }

  if (updated.length === 0) {
    return c.json({ error: 'staff_deactivation_not_allowed' }, 409)
  }

  try {
    await auth.api.revokeUserSessions({
      headers: c.req.raw.headers,
      body: { userId: targetId },
    })
  } catch {
    // The account is already banned and the middleware rejects its sessions,
    // but the caller must know that session revocation still needs a retry.
    return c.json({ error: 'session_revocation_pending' }, 502)
  }

  return c.json({ id: targetId, banned: true })
})

staffRoutes.post('/:id/reactivate', requireAdmin, async (c) => {
  const targetId = c.req.param('id')

  const updated = await getDb()
    .update(user)
    .set({ banned: false, banReason: null })
    .where(eq(user.id, targetId))
    .returning({ id: user.id })

  if (updated.length === 0) {
    return c.json({ error: 'staff_not_found' }, 404)
  }

  return c.json({ id: targetId, banned: false })
})
