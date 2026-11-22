import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

type Database = ReturnType<typeof createDatabase>

let database: Database | undefined

function createDatabase() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to apps/api/.env')
  }

  return drizzle(neon(connectionString), { schema })
}

// Lazy so route tests can import the app without a live connection string.
export function getDb(): Database {
  if (!database) {
    database = createDatabase()
  }

  return database
}
