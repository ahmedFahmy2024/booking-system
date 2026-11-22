import { Hono } from 'hono'
import { bookingsRoutes } from './features/bookings/index.js'

export const app = new Hono()

app.get('/', (c) => c.text('Hello Hono!'))

app.route('/bookings', bookingsRoutes)

export type AppType = typeof app
