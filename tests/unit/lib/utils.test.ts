import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

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
    // This tests tailwind-merge functionality
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('Email validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  it('accepts valid email addresses', () => {
    expect('test@example.com').toMatch(emailRegex)
    expect('user+tag@company.co.uk').toMatch(emailRegex)
    expect('name.surname@domain.org').toMatch(emailRegex)
  })

  it('rejects invalid email addresses', () => {
    expect('invalid').not.toMatch(emailRegex)
    expect('no@domain').not.toMatch(emailRegex)
    expect('@example.com').not.toMatch(emailRegex)
    expect('missing@.com').not.toMatch(emailRegex)
  })
})
