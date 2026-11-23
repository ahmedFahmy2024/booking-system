import { createMiddleware } from 'hono/factory'
import type { AuthEnv } from './auth/middleware.js'

type Bucket = { count: number; resetAt: number }

// Single-process fixed-window limiter. D8 targets one always-on Node service,
// so this is sufficient for that deployment. It resets on restart and is not
// shared between instances; make it durable/centralised before scaling out.
const buckets = new Map<string, Bucket>()

/** Test seam so one suite's requests do not consume another's budget. */
export function resetRateLimits(): void {
  buckets.clear()
}

export function rateLimit(name: string, max: number, windowMs = 60_000) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    const key = `${name}:${forwarded || 'unknown'}`
    const now = Date.now()
    let bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      // Bound memory on a long-lived process by pruning spent buckets.
      if (buckets.size > 1000) {
        for (const [storedKey, stored] of buckets) {
          if (stored.resetAt <= now) buckets.delete(storedKey)
        }
      }
      bucket = { count: 1, resetAt: now + windowMs }
      buckets.set(key, bucket)
      await next()
      return
    }

    if (bucket.count >= max) {
      c.header('Cache-Control', 'no-store')
      return c.json({ error: 'too_many_requests' }, 429)
    }

    bucket.count += 1
    await next()
  })
}
