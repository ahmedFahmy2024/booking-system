import { Hono } from 'hono'
import { auth } from './auth.js'
import type { AuthEnv } from './auth/middleware.js'
import { bookingsRoutes } from './features/bookings/index.js'
import { cinemaAdminRoutes } from './features/cinema-admin/index.js'
import { guestRoutes } from './features/guest/index.js'
import { servicesRoutes } from './features/services/index.js'
import { staffRoutes } from './features/staff/index.js'

export const app = new Hono<AuthEnv>()

app.get('/', (c) => c.text('Hello Hono!'))

// Better Auth owns /api/auth on the API origin. Register before other routes.
app.all('/api/auth/*', (c) => auth.handler(c.req.raw))

app.route('/staff', staffRoutes)
app.route('/admin', cinemaAdminRoutes)
app.route('/bookings', bookingsRoutes)
app.route('/services', servicesRoutes)
app.route('/guest', guestRoutes)

export type AppType = typeof app
export default app
