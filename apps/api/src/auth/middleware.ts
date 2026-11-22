import { createMiddleware } from 'hono/factory'
import { auth } from '../auth.js'

export type AuthEnv = {
  Variables: {
    session: typeof auth.$Infer.Session | null
  }
}

function activeSession(headers: Headers) {
  return auth.api.getSession({ headers })
}

export const requireStaff = createMiddleware<AuthEnv>(async (c, next) => {
  const session = c.get('session') ?? (await activeSession(c.req.raw.headers))

  if (!session) {
    return c.json({ error: 'authentication_required' }, 401)
  }
  // Better Auth checks `banned` when a session is created, but not on every
  // request. Keep the deactivation rule true even if session revocation fails.
  if (session.user.banned) {
    return c.json({ error: 'staff_account_inactive' }, 403)
  }

  c.set('session', session)
  await next()
})

export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const session = c.get('session') ?? (await activeSession(c.req.raw.headers))

  if (!session) {
    return c.json({ error: 'authentication_required' }, 401)
  }
  if (session.user.banned) {
    return c.json({ error: 'staff_account_inactive' }, 403)
  }
  if (session.user.role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403)
  }

  c.set('session', session)
  await next()
})
