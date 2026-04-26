import { describe, test, expect } from 'vitest'
import { SLIDES, getSlide, isSlideKey } from '@/lib/reviews/slides/registry'

describe('slide registry', () => {
  test('exposes 7 slides in deck order: cover, ga, linkedin, content, initiatives, takeaways, planning', () => {
    expect(SLIDES.map((s) => s.key)).toEqual([
      'cover',
      'ga_summary',
      'linkedin_insights',
      'content_highlights',
      'initiatives',
      'takeaways',
      'planning',
    ])
  })

  test('cover slide is not hideable', () => {
    expect(getSlide('cover').hideable).toBe(false)
  })

  test('every body slide is hideable', () => {
    const body = SLIDES.filter((s) => s.key !== 'cover')
    expect(body.every((s) => s.hideable)).toBe(true)
  })

  test('cover narrativeBlockKey is cover_subtitle, body slides match their key', () => {
    expect(getSlide('cover').narrativeBlockKey).toBe('cover_subtitle')
    expect(getSlide('ga_summary').narrativeBlockKey).toBe('ga_summary')
    expect(getSlide('content_highlights').narrativeBlockKey).toBe('content_highlights')
  })

  test('isSlideKey accepts known keys, rejects unknown', () => {
    expect(isSlideKey('ga_summary')).toBe(true)
    expect(isSlideKey('not_a_slide')).toBe(false)
  })

  test('getSlide throws on unknown key', () => {
    expect(() => getSlide('not_a_slide' as unknown as 'cover')).toThrow()
  })
})
