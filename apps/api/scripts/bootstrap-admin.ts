import 'dotenv/config'
import { auth } from '../src/auth.js'
import { getDb } from '../src/db/index.js'
import { user } from '../src/db/auth-schema.js'

// One-time server command. It refuses to run once any staff account exists.
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME ?? 'Admin'

if (!email || !password) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap the first admin.')
}

const existing = await getDb().select({ id: user.id }).from(user).limit(1)
if (existing.length > 0) {
  throw new Error('Staff already exist. Bootstrap runs once; invite further staff from the admin area.')
}

const created = await auth.api.createUser({
  body: { email, password, name, role: 'admin' },
})

console.log(`Created first admin ${created.user.id}`)
