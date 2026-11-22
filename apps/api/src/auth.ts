import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins/admin'
import {
  invitationPath,
  revokeSessionsOnPasswordReset,
  staffInvitationTtlSeconds,
} from './auth/config.js'
import { ac, adminRole, operationsRole } from './auth/permissions.js'
import { getDb } from './db/index.js'
import * as schema from './db/schema.js'
import { sendMail } from './features/mail/index.js'

const isProduction = process.env.NODE_ENV === 'production'
export const webUrl = process.env.APP_URL ?? 'http://localhost:5173'

// Better Auth reads BETTER_AUTH_SECRET/BETTER_AUTH_URL from the environment.
// Only supply config values when the environment has not set them; the local
// fallback keeps tests deterministic while production must supply a secret.
const localSecret = 'local-development-secret-not-for-production-use'

export const auth = betterAuth({
  appName: 'Cinema Booking',
  basePath: '/api/auth',
  ...(process.env.BETTER_AUTH_SECRET
    ? {}
    : { secret: isProduction ? undefined : localSecret }),
  ...(process.env.BETTER_AUTH_URL ? {} : { baseURL: 'http://localhost:3000' }),
  rateLimit: { enabled: true },
  trustedOrigins: [webUrl, 'http://localhost:5173'],
  database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    // Staff are provisioned by an admin or the one-time bootstrap command.
    disableSignUp: true,
    minPasswordLength: 12,
    revokeSessionsOnPasswordReset,
    // D1: the staff invitation link is valid for 24 hours.
    resetPasswordTokenExpiresIn: staffInvitationTtlSeconds,
    sendResetPassword: async ({ user, url }) => {
      // Better Auth URL-encodes callbackURL, so compare the decoded value.
      const callbackURL = new URL(url).searchParams.get('callbackURL')
      const invitation = callbackURL === `${webUrl}${invitationPath}`
      await sendMail({
        to: user.email,
        subject: invitation
          ? 'دعوة لطاقم السينما — تعيين كلمة المرور'
          : 'إعادة تعيين كلمة المرور',
        text: invitation
          ? `تمت دعوتك للانضمام إلى طاقم السينما. عيّن كلمة المرور خلال 24 ساعة: ${url}`
          : `لتعيين كلمة مرور جديدة استخدم هذا الرابط: ${url}`,
        kind: invitation ? 'staff-invitation' : 'password-reset',
      })
    },
  },
  plugins: [
    admin({
      ac,
      roles: { admin: adminRole, operations: operationsRole },
      defaultRole: 'operations',
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: isProduction,
    // Render terminates TLS and forwards the client address; rate limits and
    // audit records need the real IP rather than the proxy's address.
    ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
  },
})

export type StaffSession = typeof auth.$Infer.Session
