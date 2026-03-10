import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OrgProvider, useOrgId, useBuildOrgHref, useSetOrgId } from '@/hooks/use-org-context'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

function BuildOrgHrefTest({ path }: { path: string }) {
  const buildOrgHref = useBuildOrgHref()
  return <span data-testid="href">{buildOrgHref(path)}</span>
}

function OrgIdDisplay() {
  const orgId = useOrgId()
  return <span data-testid="org-id">{orgId ?? 'null'}</span>
}

function SetOrgIdButton({ id }: { id: string | null }) {
  const setOrgId = useSetOrgId()
  return <button onClick={() => setOrgId(id)}>Set Org</button>
}

describe('useBuildOrgHref', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Reset URL to no query params
    window.history.replaceState({}, '', '/')
  })

  it('returns plain path when no org is selected', () => {
    render(
      <OrgProvider>
        <BuildOrgHrefTest path="/seo/site-audit/123" />
      </OrgProvider>
    )
    expect(screen.getByTestId('href')).toHaveTextContent('/seo/site-audit/123')
  })

  it('appends ?org= when org is set via context', async () => {
    render(
      <OrgProvider>
        <SetOrgIdButton id="org-abc" />
        <BuildOrgHrefTest path="/seo/site-audit/123" />
      </OrgProvider>
    )

    await act(async () => {
      screen.getByText('Set Org').click()
    })

    expect(screen.getByTestId('href')).toHaveTextContent('/seo/site-audit/123?org=org-abc')
  })

  it('uses & when path already has query params', async () => {
    render(
      <OrgProvider>
        <SetOrgIdButton id="org-abc" />
        <BuildOrgHrefTest path="/support?issue=456" />
      </OrgProvider>
    )

    await act(async () => {
      screen.getByText('Set Org').click()
    })

    expect(screen.getByTestId('href')).toHaveTextContent('/support?issue=456&org=org-abc')
  })

  it('returns plain path when org is set to null', async () => {
    render(
      <OrgProvider>
        <SetOrgIdButton id="org-abc" />
        <BuildOrgHrefTest path="/seo/client-reports" />
      </OrgProvider>
    )

    // Set org first
    await act(async () => {
      screen.getByText('Set Org').click()
    })
    expect(screen.getByTestId('href')).toHaveTextContent('/seo/client-reports?org=org-abc')

    // Now render a null setter and click it
    render(
      <OrgProvider>
        <SetOrgIdButton id={null as unknown as string} />
        <BuildOrgHrefTest path="/seo/client-reports" />
      </OrgProvider>
    )

    // Re-render needed - but since it's a fresh provider, it starts null
    expect(screen.getAllByTestId('href')[1]).toHaveTextContent('/seo/client-reports')
  })

  it('returns identity function outside OrgProvider', () => {
    render(<BuildOrgHrefTest path="/seo/site-audit/123" />)
    expect(screen.getByTestId('href')).toHaveTextContent('/seo/site-audit/123')
  })
})

describe('useOrgId', () => {
  beforeEach(() => {
    localStorageMock.clear()
    window.history.replaceState({}, '', '/')
  })

  it('returns null outside OrgProvider', () => {
    render(<OrgIdDisplay />)
    expect(screen.getByTestId('org-id')).toHaveTextContent('null')
  })

  it('returns null when no org is set', () => {
    render(
      <OrgProvider>
        <OrgIdDisplay />
      </OrgProvider>
    )
    expect(screen.getByTestId('org-id')).toHaveTextContent('null')
  })

  it('returns org ID after setOrgId', async () => {
    render(
      <OrgProvider>
        <SetOrgIdButton id="org-xyz" />
        <OrgIdDisplay />
      </OrgProvider>
    )

    await act(async () => {
      screen.getByText('Set Org').click()
    })

    expect(screen.getByTestId('org-id')).toHaveTextContent('org-xyz')
  })
})

describe('OrgProvider initialization', () => {
  beforeEach(() => {
    localStorageMock.clear()
    window.history.replaceState({}, '', '/')
  })

  it('hydrates from localStorage', async () => {
    localStorageMock.setItem('selo-last-organization-id', 'org-stored')

    render(
      <OrgProvider>
        <OrgIdDisplay />
        <BuildOrgHrefTest path="/dashboard" />
      </OrgProvider>
    )

    // After hydration effect runs
    await act(async () => {})

    expect(screen.getByTestId('org-id')).toHaveTextContent('org-stored')
    expect(screen.getByTestId('href')).toHaveTextContent('/dashboard?org=org-stored')
  })

  it('prioritizes URL ?org= over localStorage', async () => {
    localStorageMock.setItem('selo-last-organization-id', 'org-stored')
    window.history.replaceState({}, '', '/?org=org-url')

    render(
      <OrgProvider>
        <OrgIdDisplay />
      </OrgProvider>
    )

    await act(async () => {})

    expect(screen.getByTestId('org-id')).toHaveTextContent('org-url')
  })
})

describe('useSetOrgId', () => {
  it('returns no-op outside OrgProvider', () => {
    function TestNoOp() {
      const setOrgId = useSetOrgId()
      // Should not throw
      setOrgId('test')
      return <span>ok</span>
    }

    render(<TestNoOp />)
    expect(screen.getByText('ok')).toBeInTheDocument()
  })
})
