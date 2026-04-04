import { describe, it, expect } from 'vitest'
import {
  cn,
  displayName,
  formatDate,
  formatDuration,
  calculateDuration,
  getDomain,
  pluralize,
  formatAuditDate,
} from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-2')).toBe('px-2 py-2')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('merges conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('displayName', () => {
  it('converts snake_case to Title Case', () => {
    expect(displayName('team_member')).toBe('Team Member')
  })

  it('capitalizes single word', () => {
    expect(displayName('admin')).toBe('Admin')
  })

  it('handles multiple underscores', () => {
    expect(displayName('external_developer')).toBe('External Developer')
  })
})

describe('formatDate', () => {
  it('formats date with time by default', () => {
    const result = formatDate('2026-03-01T14:30:00Z')
    expect(result).toContain('1st')
    expect(result).toContain('Mar')
    expect(result).toContain('2026')
    expect(result).toContain('at')
  })

  it('formats date without time when includeTime is false', () => {
    const result = formatDate('2026-03-01T14:30:00Z', false)
    expect(result).toContain('1st')
    expect(result).toContain('Mar')
    expect(result).not.toContain('at')
  })

  it('uses correct ordinal suffixes', () => {
    // Use noon UTC to avoid timezone boundary issues
    // 2nd
    expect(formatDate('2026-03-02T12:00:00Z', false)).toContain('2nd')
    // 3rd
    expect(formatDate('2026-03-03T12:00:00Z', false)).toContain('3rd')
    // 11th (special case - not 11st)
    expect(formatDate('2026-03-11T12:00:00Z', false)).toContain('11th')
    // 21st
    expect(formatDate('2026-03-21T12:00:00Z', false)).toContain('21st')
  })
})

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(5000)).toBe('5s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(142000)).toBe('2:22s')
  })

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3661000)).toBe('1:01:01s')
  })

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0s')
  })
})

describe('calculateDuration', () => {
  it('calculates duration between two timestamps', () => {
    const result = calculateDuration('2026-01-01T10:00:00Z', '2026-01-01T10:05:00Z')
    expect(result).toBe(300000) // 5 minutes in ms
  })

  it('returns null when start is null', () => {
    expect(calculateDuration(null, '2026-01-01T10:00:00Z')).toBeNull()
  })

  it('returns null when end is null', () => {
    expect(calculateDuration('2026-01-01T10:00:00Z', null)).toBeNull()
  })
})

describe('getDomain', () => {
  it('extracts hostname from valid URL', () => {
    expect(getDomain('https://example.com/path')).toBe('example.com')
  })

  it('returns original string for invalid URL', () => {
    expect(getDomain('not-a-url')).toBe('not-a-url')
  })

  it('returns fallback for null', () => {
    expect(getDomain(null, 'N/A')).toBe('N/A')
  })

  it('returns empty string for undefined without fallback', () => {
    expect(getDomain(undefined)).toBe('')
  })
})

describe('pluralize', () => {
  it('returns singular form for count of 1', () => {
    expect(pluralize(1, 'image')).toBe('1 image')
  })

  it('returns plural form for count > 1', () => {
    expect(pluralize(3, 'image')).toBe('3 images')
  })

  it('returns plural form for count of 0', () => {
    expect(pluralize(0, 'image')).toBe('0 images')
  })

  it('uses custom plural form when provided', () => {
    expect(pluralize(2, 'person', 'people')).toBe('2 people')
  })
})

describe('formatAuditDate', () => {
  it('formats date in short month format', () => {
    const result = formatAuditDate('2026-02-27T12:00:00Z')
    expect(result).toContain('Feb')
    expect(result).toContain('27')
    expect(result).toContain('2026')
  })
})
