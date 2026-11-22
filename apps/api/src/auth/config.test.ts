import { describe, expect, it } from 'vitest'
import {
  invitationPath,
  revokeSessionsOnPasswordReset,
  staffInvitationTtlSeconds,
} from './config.js'

describe('staff auth configuration', () => {
  it('keeps an invitation link valid for 24 hours', () => {
    expect(staffInvitationTtlSeconds).toBe(24 * 60 * 60)
  })

  it('revokes sessions when a password is reset', () => {
    expect(revokeSessionsOnPasswordReset).toBe(true)
  })

  it('uses the staff password setup path for invitations', () => {
    expect(invitationPath).toBe('/staff/set-password')
  })
})
