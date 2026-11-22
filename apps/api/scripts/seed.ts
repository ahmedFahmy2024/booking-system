import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { services } from '../src/db/schema.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to apps/api/.env')
}

const db = drizzle(neon(connectionString), { schema: { services } })

const seedServices = [
  { name: 'Standard Screening', durationMinutes: 120 },
  { name: 'VIP Screening', durationMinutes: 150 },
  { name: 'IMAX Screening', durationMinutes: 150 },
]

const existing = await db.select({ name: services.name }).from(services)
const existingNames = new Set(existing.map((row) => row.name))
const missing = seedServices.filter((service) => !existingNames.has(service.name))

if (missing.length > 0) {
  await db.insert(services).values(missing)
  console.log(`Inserted ${missing.length} service(s).`)
} else {
  console.log('Services already seeded.')
}

console.log(await db.select().from(services))
