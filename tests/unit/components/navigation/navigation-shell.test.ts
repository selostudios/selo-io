import { describe, it, expect } from 'vitest'
import { getSectionFromPathname } from '@/components/navigation/navigation-shell'

describe('getSectionFromPathname', () => {
  it('maps /ai-visibility routes to home section', () => {
    expect(getSectionFromPathname('/ai-visibility')).toBe('home')
    expect(getSectionFromPathname('/ai-visibility/prompts')).toBe('home')
    expect(getSectionFromPathname('/ai-visibility/mentions')).toBe('home')
  })

  it('maps /ai-visibility routes with org UUID prefix to home section', () => {
    const orgId = '12345678-1234-1234-1234-123456789012'
    expect(getSectionFromPathname(`/${orgId}/ai-visibility`)).toBe('home')
    expect(getSectionFromPathname(`/${orgId}/ai-visibility/prompts`)).toBe('home')
  })

  it('maps /seo routes to home section', () => {
    expect(getSectionFromPathname('/seo/audit')).toBe('home')
    expect(getSectionFromPathname('/seo/client-reports')).toBe('home')
  })

  it('maps /dashboard routes to home section', () => {
    expect(getSectionFromPathname('/dashboard')).toBe('home')
    expect(getSectionFromPathname('/dashboard/campaigns')).toBe('home')
  })

  it('maps /quick-audit to quick-audit section', () => {
    expect(getSectionFromPathname('/quick-audit')).toBe('quick-audit')
  })

  it('maps /organizations to organizations section', () => {
    expect(getSectionFromPathname('/organizations')).toBe('organizations')
  })

  it('maps /support to support section', () => {
    expect(getSectionFromPathname('/support')).toBe('support')
  })
})
