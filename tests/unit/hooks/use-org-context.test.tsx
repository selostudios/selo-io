import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useOrgId, useBuildOrgHref } from '@/hooks/use-org-context'

let mockPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

function OrgIdDisplay() {
  const orgId = useOrgId()
  return <span data-testid="org-id">{orgId ?? 'null'}</span>
}

function BuildOrgHrefTest({ path }: { path: string }) {
  const buildOrgHref = useBuildOrgHref()
  return <span data-testid="href">{buildOrgHref(path)}</span>
}

describe('useOrgId', () => {
  it('returns null when pathname has no UUID segment', () => {
    mockPathname = '/dashboard'
    render(<OrgIdDisplay />)
    expect(screen.getByTestId('org-id')).toHaveTextContent('null')
  })

  it('returns null for root path', () => {
    mockPathname = '/'
    render(<OrgIdDisplay />)
    expect(screen.getByTestId('org-id')).toHaveTextContent('null')
  })

  it('returns UUID when first segment is a valid UUID', () => {
    mockPathname = '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/dashboard'
    render(<OrgIdDisplay />)
    expect(screen.getByTestId('org-id')).toHaveTextContent('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('returns null when first segment is not a UUID', () => {
    mockPathname = '/quick-audit'
    render(<OrgIdDisplay />)
    expect(screen.getByTestId('org-id')).toHaveTextContent('null')
  })

  it('handles uppercase UUIDs', () => {
    mockPathname = '/A1B2C3D4-E5F6-7890-ABCD-EF1234567890/seo/audit'
    render(<OrgIdDisplay />)
    expect(screen.getByTestId('org-id')).toHaveTextContent('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')
  })
})

describe('useBuildOrgHref', () => {
  it('returns path unchanged when no org in URL', () => {
    mockPathname = '/quick-audit'
    render(<BuildOrgHrefTest path="/seo/audit" />)
    expect(screen.getByTestId('href')).toHaveTextContent('/seo/audit')
  })

  it('prepends org ID to path when org is in URL', () => {
    mockPathname = '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/dashboard'
    render(<BuildOrgHrefTest path="/seo/audit" />)
    expect(screen.getByTestId('href')).toHaveTextContent(
      '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/seo/audit'
    )
  })

  it('does not double-prefix if path already starts with org ID', () => {
    mockPathname = '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/dashboard'
    render(
      <BuildOrgHrefTest path="/a1b2c3d4-e5f6-7890-abcd-ef1234567890/seo/audit" />
    )
    expect(screen.getByTestId('href')).toHaveTextContent(
      '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/seo/audit'
    )
  })

  it('handles paths without leading slash', () => {
    mockPathname = '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/dashboard'
    render(<BuildOrgHrefTest path="settings" />)
    expect(screen.getByTestId('href')).toHaveTextContent(
      '/a1b2c3d4-e5f6-7890-abcd-ef1234567890/settings'
    )
  })
})
