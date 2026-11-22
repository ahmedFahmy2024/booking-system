import { Hono } from 'hono'
import { bookingsRoutes } from './features/bookings/index.js'
import { servicesRoutes } from './features/services/index.js'

export const app = new Hono()

app.get('/', (c) => c.text('Hello Hono!'))

app.route('/bookings', bookingsRoutes)
app.route('/services', servicesRoutes)

export type AppType = typeof app
