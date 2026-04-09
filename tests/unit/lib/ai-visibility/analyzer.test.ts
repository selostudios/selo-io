import { describe, it, expect } from 'vitest'
import { detectBrandMention, extractCitations, detectCompetitors } from '@/lib/ai-visibility/analyzer'

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

describe('extractCitations', () => {
  const domain = 'warbyparker.com'

  it('extracts domain citations from native citation URLs', () => {
    const result = extractCitations(
      [
        'https://warbyparker.com/glasses',
        'https://zenni.com/frames',
        'https://www.warbyparker.com/about',
      ],
      domain
    )
    expect(result.domainCited).toBe(true)
    expect(result.citedUrls).toEqual([
      'https://warbyparker.com/glasses',
      'https://www.warbyparker.com/about',
    ])
  })

  it('extracts URLs from response text when no native citations', () => {
    const result = extractCitations(
      [],
      domain,
      'Check out https://warbyparker.com/glasses for more info. Also see https://example.com.'
    )
    expect(result.domainCited).toBe(true)
    expect(result.citedUrls).toEqual(['https://warbyparker.com/glasses'])
  })

  it('returns not cited when domain is absent', () => {
    const result = extractCitations(
      ['https://zenni.com/frames'],
      domain
    )
    expect(result.domainCited).toBe(false)
    expect(result.citedUrls).toEqual([])
  })

  it('handles empty inputs', () => {
    const result = extractCitations([], domain)
    expect(result.domainCited).toBe(false)
    expect(result.citedUrls).toEqual([])
  })

  it('matches domain with www prefix', () => {
    const result = extractCitations(
      ['https://www.warbyparker.com/shop'],
      domain
    )
    expect(result.domainCited).toBe(true)
  })

  it('deduplicates URLs', () => {
    const result = extractCitations(
      ['https://warbyparker.com/glasses', 'https://warbyparker.com/glasses'],
      domain
    )
    expect(result.citedUrls).toEqual(['https://warbyparker.com/glasses'])
  })
})

describe('detectCompetitors', () => {
  it('detects competitor mentions in response text', () => {
    const result = detectCompetitors(
      'Both Zenni Optical and EyeBuyDirect offer affordable frames online.',
      ['Zenni Optical', 'EyeBuyDirect', 'LensCrafters'],
      ['https://zenni.com/frames']
    )
    expect(result).toEqual([
      { name: 'Zenni Optical', mentioned: true, cited: true },
      { name: 'EyeBuyDirect', mentioned: true, cited: false },
      { name: 'LensCrafters', mentioned: false, cited: false },
    ])
  })

  it('returns empty array when no competitors configured', () => {
    const result = detectCompetitors('Some text', [], [])
    expect(result).toEqual([])
  })

  it('is case-insensitive', () => {
    const result = detectCompetitors(
      'zenni optical has good prices',
      ['Zenni Optical'],
      []
    )
    expect(result[0].mentioned).toBe(true)
  })

  it('detects citations matching competitor domains', () => {
    const result = detectCompetitors(
      'Check out these eyewear options.',
      ['Zenni Optical'],
      ['https://www.zenni.com/glasses'],
      { 'Zenni Optical': 'zenni.com' }
    )
    expect(result[0].cited).toBe(true)
  })
})
