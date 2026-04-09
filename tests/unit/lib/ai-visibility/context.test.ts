import { describe, it, expect } from 'vitest'
import { buildOrgContext } from '@/lib/ai-visibility/context'

describe('buildOrgContext', () => {
  it('builds context from org name and website URL', () => {
    const context = buildOrgContext({
      orgName: 'Warby Parker',
      websiteUrl: 'https://www.warbyparker.com',
      competitors: [],
    })
    expect(context.brandName).toBe('Warby Parker')
    expect(context.domain).toBe('warbyparker.com')
    expect(context.competitors).toEqual([])
    expect(context.competitorDomains).toEqual({})
  })

  it('strips www from domain', () => {
    const context = buildOrgContext({
      orgName: 'Test',
      websiteUrl: 'https://www.example.com/about',
      competitors: [],
    })
    expect(context.domain).toBe('example.com')
  })

  it('handles URL without www', () => {
    const context = buildOrgContext({
      orgName: 'Test',
      websiteUrl: 'https://example.com',
      competitors: [],
    })
    expect(context.domain).toBe('example.com')
  })

  it('maps competitors to names and domain lookup', () => {
    const context = buildOrgContext({
      orgName: 'Warby Parker',
      websiteUrl: 'https://warbyparker.com',
      competitors: [
        { name: 'Zenni Optical', domain: 'zenni.com' },
        { name: 'EyeBuyDirect', domain: 'eyebuydirect.com' },
      ],
    })
    expect(context.competitors).toEqual(['Zenni Optical', 'EyeBuyDirect'])
    expect(context.competitorDomains).toEqual({
      'Zenni Optical': 'zenni.com',
      EyeBuyDirect: 'eyebuydirect.com',
    })
  })

  it('handles missing website URL gracefully', () => {
    const context = buildOrgContext({
      orgName: 'Test Co',
      websiteUrl: null,
      competitors: [],
    })
    expect(context.domain).toBe('')
  })

  it('handles malformed URL gracefully', () => {
    const context = buildOrgContext({
      orgName: 'Test Co',
      websiteUrl: 'not-a-url',
      competitors: [],
    })
    expect(context.domain).toBe('')
  })
})
