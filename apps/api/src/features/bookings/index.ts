import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../../db/index.js'
import { bookings, services } from '../../db/schema.js'

export const bookingsRoutes = new Hono()

const createBookingSchema = z.object({
  serviceId: z.number().int().positive(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  startsAt: z.iso.datetime(),
})

bookingsRoutes.get('/', async (c) => {
  const rows = await getDb()
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      startsAt: bookings.startsAt,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))

  return c.json(rows)
})

bookingsRoutes.post('/', zValidator('json', createBookingSchema), async (c) => {
  const input = c.req.valid('json')

  const [created] = await getDb()
    .insert(bookings)
    .values({
      serviceId: input.serviceId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      startsAt: new Date(input.startsAt),
    })
    .returning()

  return c.json(created, 201)
})
