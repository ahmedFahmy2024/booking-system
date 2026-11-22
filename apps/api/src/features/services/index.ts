import { Hono } from 'hono'
import { getDb } from '../../db/index.js'
import { services } from '../../db/schema.js'

export const servicesRoutes = new Hono()

servicesRoutes.get('/', async (c) => {
  const rows = await getDb()
    .select({
      id: services.id,
      name: services.name,
      durationMinutes: services.durationMinutes,
    })
    .from(services)

  return c.json(rows)
})
