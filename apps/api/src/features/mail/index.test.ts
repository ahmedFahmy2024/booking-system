import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCapturedMessages,
  getCapturedMessages,
  localMailAdapter,
} from './index.js'

beforeEach(() => {
  clearCapturedMessages()
})

describe('local mail adapter', () => {
  it('captures a message without writing it to logs', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const message = {
      to: 'staff@example.com',
      subject: 'دعوة لطاقم السينما',
      text: 'https://example.com/staff/set-password?token=secret',
      kind: 'staff-invitation' as const,
    }

    await localMailAdapter.send(message)

    expect(getCapturedMessages()).toEqual([message])
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
