import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'

const statement = {
  ...defaultStatements,
} as const

export const ac = createAccessControl(statement)

// Admin can manage staff through the Better Auth admin endpoints.
export const adminRole = ac.newRole({
  ...adminAc.statements,
})

// Operations staff cannot use staff-management endpoints; booking operations
// are guarded by our Hono middleware instead (see the permission matrix).
export const operationsRole = ac.newRole({
  user: [],
  session: [],
})
