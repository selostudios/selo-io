import { describe, it, expect } from 'vitest'
import { detectBrandMention } from '@/lib/ai-visibility/analyzer'

describe('detectBrandMention', () => {
  const brandName = 'Warby Parker'

  it('detects a brand mention in the response', () => {
    const result = detectBrandMention(
      'Warby Parker is a popular eyewear retailer known for affordable glasses.',
      brandName
    )
    expect(result.mentioned).toBe(true)
    expect(result.mentionCount).toBe(1)
  })

  it('detects multiple mentions', () => {
    const result = detectBrandMention(
      'Warby Parker offers great frames. Many people choose Warby Parker for their first pair.',
      brandName
    )
    expect(result.mentioned).toBe(true)
    expect(result.mentionCount).toBe(2)
  })

  it('is case-insensitive', () => {
    const result = detectBrandMention(
      'warby parker has expanded internationally.',
      brandName
    )
    expect(result.mentioned).toBe(true)
  })

  it('returns not mentioned when brand is absent', () => {
    const result = detectBrandMention(
      'Zenni Optical offers budget-friendly prescription glasses online.',
      brandName
    )
    expect(result.mentioned).toBe(false)
    expect(result.mentionCount).toBe(0)
    expect(result.position).toBeNull()
  })

  it('calculates position in first third', () => {
    const result = detectBrandMention(
      'Warby Parker is great. The rest of this text is filler. More filler text here to pad it out significantly.',
      brandName
    )
    expect(result.position).toBe(1)
  })

  it('calculates position in last third', () => {
    const result = detectBrandMention(
      'There are many eyewear brands available today. You have lots of options to consider. In conclusion, Warby Parker is worth checking out.',
      brandName
    )
    expect(result.position).toBe(3)
  })

  it('handles empty text', () => {
    const result = detectBrandMention('', brandName)
    expect(result.mentioned).toBe(false)
  })

  it('handles brand aliases', () => {
    const result = detectBrandMention(
      'WP eyewear has great customer service.',
      brandName,
      ['WP']
    )
    expect(result.mentioned).toBe(true)
  })
})
