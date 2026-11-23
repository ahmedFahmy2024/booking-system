import { describe, expect, it } from 'vitest'
import { formatCairoDateTime, formatEgp } from './cinema-format'

describe('cinema formatting', () => {
  it('shows a UTC instant as Cairo wall time', () => {
    // 14:00Z is 16:00 in winter in Cairo (UTC+2).
    expect(formatCairoDateTime('2026-12-01T14:00:00.000Z', 'en')).toContain('4:00 PM')
    expect(formatCairoDateTime('2026-12-01T14:00:00.000Z', 'en')).toContain('Dec 1, 2026')
  })

  it('shows integer piastres as EGP', () => {
    expect(formatEgp(2500, 'en')).toContain('25')
    expect(formatEgp(2500, 'en')).toContain('EGP')
  })
})
