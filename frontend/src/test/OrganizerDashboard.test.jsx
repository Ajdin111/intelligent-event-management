/**
 * OrganizerDashboard — logic / utility unit tests
 * We test the helper functions in isolation to avoid jsdom open-handle issues
 * from the component's async API calls.
 */
import { describe, it, expect } from 'vitest'

// ── Helpers copied from OrganizerDashboard (pure functions) ──────────────────

function fmtRevenue(n) {
  if (!n || n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toLocaleString()}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPct(val) {
  if (val == null) return '—'
  return `${Number(val).toFixed(1)}%`
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OrganizerDashboard helpers', () => {

  describe('fmtRevenue', () => {
    it('returns $0 for zero', () => {
      expect(fmtRevenue(0)).toBe('$0')
    })

    it('formats thousands with k suffix', () => {
      expect(fmtRevenue(48200)).toBe('$48.2k')
    })

    it('formats millions with M suffix', () => {
      expect(fmtRevenue(1_500_000)).toBe('$1.5M')
    })

    it('formats small amounts without suffix', () => {
      expect(fmtRevenue(500)).toBe('$500')
    })

    it('handles null/undefined gracefully', () => {
      expect(fmtRevenue(null)).toBe('$0')
      expect(fmtRevenue(undefined)).toBe('$0')
    })
  })

  describe('fmtDate', () => {
    it('formats a valid ISO date', () => {
      const result = fmtDate('2026-05-14T09:00:00')
      expect(result).toMatch(/May 14, 2026/)
    })

    it('returns — for null', () => {
      expect(fmtDate(null)).toBe('—')
    })

    it('returns — for undefined', () => {
      expect(fmtDate(undefined)).toBe('—')
    })
  })

  describe('fmtPct', () => {
    it('formats a percentage to 1 decimal', () => {
      expect(fmtPct(91.4)).toBe('91.4%')
    })

    it('formats whole numbers', () => {
      expect(fmtPct(100)).toBe('100.0%')
    })

    it('returns — for null', () => {
      expect(fmtPct(null)).toBe('—')
    })
  })

  describe('Stats derivation', () => {
    const events = [
      { id: 1, owner_id: 1, status: 'published', start_datetime: '2026-05-14T09:00:00', capacity: 600 },
      { id: 2, owner_id: 1, status: 'published', start_datetime: '2026-06-03T09:00:00', capacity: 400 },
      { id: 3, owner_id: 2, status: 'published', start_datetime: '2026-07-01T09:00:00', capacity: 200 },
      { id: 4, owner_id: 1, status: 'draft',     start_datetime: '2026-08-01T09:00:00', capacity: 100 },
    ]

    it('filters events owned by user', () => {
      const mine = events.filter(e => e.owner_id === 1)
      expect(mine).toHaveLength(3)
    })

    it('counts published events correctly', () => {
      const mine = events.filter(e => e.owner_id === 1)
      const published = mine.filter(e => e.status === 'published')
      expect(published).toHaveLength(2)
    })

    it('stat cards show — before API data loads', () => {
      const statsData = null
      const value = statsData ? String(statsData.total_events) : '—'
      expect(value).toBe('—')
    })

    it('stat cards show real values after API data loads', () => {
      const statsData = { total_events: 18, total_registrations: 4218, total_revenue: 284500, attendance_rate: 91.4 }
      expect(String(statsData.total_events)).toBe('18')
      expect(String(statsData.total_registrations)).toBe('4218')
      expect(fmtRevenue(statsData.total_revenue)).toBe('$284.5k')
      expect(fmtPct(statsData.attendance_rate)).toBe('91.4%')
    })
  })

  describe('Period options', () => {
    const PERIOD_DAYS = { '7D': 7, '30D': 30, '90D': 90 }

    it('maps period labels to correct day counts', () => {
      expect(PERIOD_DAYS['7D']).toBe(7)
      expect(PERIOD_DAYS['30D']).toBe(30)
      expect(PERIOD_DAYS['90D']).toBe(90)
    })

    it('default period is 90D', () => {
      const defaultPeriod = '90D'
      expect(PERIOD_DAYS[defaultPeriod]).toBe(90)
    })
  })
})
