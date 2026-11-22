import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  revokeUserSessions: vi.fn(),
  listUsers: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}))

vi.mock('../../auth.js', () => ({
  webUrl: 'http://localhost:5173',
  auth: {
    api: {
      getSession: mocks.getSession,
      createUser: mocks.createUser,
      requestPasswordReset: mocks.requestPasswordReset,
      revokeUserSessions: mocks.revokeUserSessions,
      listUsers: mocks.listUsers,
    },
    handler: vi.fn(),
  },
}))

vi.mock('../../db/index.js', () => ({
  getDb: () => ({ update: mocks.update }),
}))

import { app } from '../../app.js'

const adminSession = {
  user: { id: 'admin-1', role: 'admin' },
  session: { id: 'session-1' },
}

const invitation = {
  name: 'Fatma',
  email: 'fatma@example.com',
  role: 'operations',
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.update.mockReturnValue({ set: mocks.set })
  mocks.set.mockReturnValue({ where: mocks.where })
  mocks.where.mockReturnValue({ returning: mocks.returning })
})

function postInvite() {
  return app.request('/staff/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invitation),
  })
}

describe('staff routes', () => {
  it('refuses an unauthenticated invitation', async () => {
    mocks.getSession.mockResolvedValue(null)

    const res = await postInvite()

    expect(res.status).toBe(401)
    expect(mocks.createUser).not.toHaveBeenCalled()
  })

  it('refuses a deactivated admin even if their session was not revoked', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin', banned: true },
      session: { id: 'session-1' },
    })

    const res = await app.request('/staff')

    expect(res.status).toBe(403)
    expect(mocks.listUsers).not.toHaveBeenCalled()
  })

  it('refuses an operations role invitation', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'ops-1', role: 'operations' },
      session: { id: 'session-2' },
    })

    const res = await postInvite()

    expect(res.status).toBe(403)
    expect(mocks.createUser).not.toHaveBeenCalled()
  })

  it('provisions a staff account and sends the one-time setup link', async () => {
    mocks.getSession.mockResolvedValue(adminSession)
    mocks.createUser.mockResolvedValue({ user: { id: 'staff-1' } })
    mocks.requestPasswordReset.mockResolvedValue({ status: true })

    const res = await postInvite()

    expect(res.status).toBe(201)
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.anything(),
        body: expect.objectContaining({
          email: invitation.email,
          name: invitation.name,
          role: 'operations',
        }),
      }),
    )
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: invitation.email,
        redirectTo: 'http://localhost:5173/staff/set-password',
      },
    })
    const body = await res.json()
    expect(body).toEqual({ id: 'staff-1', email: invitation.email, role: 'operations' })
    expect(JSON.stringify(body)).not.toContain('password')
  })

  it('refuses to deactivate the last active admin', async () => {
    mocks.getSession.mockResolvedValue(adminSession)
    mocks.returning.mockResolvedValue([])

    const res = await app.request('/staff/admin-2/deactivate', { method: 'POST' })

    expect(res.status).toBe(409)
    expect(mocks.revokeUserSessions).not.toHaveBeenCalled()
  })

  it('revokes sessions when a staff member is deactivated', async () => {
    mocks.getSession.mockResolvedValue(adminSession)
    mocks.returning.mockResolvedValue([{ id: 'staff-2' }])

    const res = await app.request('/staff/staff-2/deactivate', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(mocks.revokeUserSessions).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: 'staff-2' } }),
    )
  })
})
