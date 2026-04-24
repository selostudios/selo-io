import { describe, test, expect } from 'vitest'
import { LinkedInPostType, isLinkedInPostType } from '@/lib/platforms/linkedin/post-types'

describe('LinkedInPostType', () => {
  test('recognises the five supported post types', () => {
    expect(isLinkedInPostType('image')).toBe(true)
    expect(isLinkedInPostType('video')).toBe(true)
    expect(isLinkedInPostType('text')).toBe(true)
    expect(isLinkedInPostType('article')).toBe(true)
    expect(isLinkedInPostType('poll')).toBe(true)
  })

  test('rejects unsupported strings', () => {
    expect(isLinkedInPostType('story')).toBe(false)
    expect(isLinkedInPostType('')).toBe(false)
  })

  test('enum values match database CHECK constraint', () => {
    expect(LinkedInPostType.Image).toBe('image')
    expect(LinkedInPostType.Text).toBe('text')
  })
})
