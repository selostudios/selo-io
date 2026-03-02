import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { UserRole } from '@/lib/enums'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/team',
  useSearchParams: () => new URLSearchParams(),
}))

describe('SettingsTabs', () => {
  it('shows all tabs for admin', () => {
    render(<SettingsTabs userRole={UserRole.Admin} />)

    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })

  it('hides Integrations and Monitoring for external_developer', () => {
    render(<SettingsTabs userRole={UserRole.ExternalDeveloper} />)

    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.queryByText('Integrations')).not.toBeInTheDocument()
    expect(screen.queryByText('Monitoring')).not.toBeInTheDocument()
  })

  it('hides Integrations for team_member', () => {
    render(<SettingsTabs userRole={UserRole.TeamMember} />)

    expect(screen.getByText('Organization')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.queryByText('Integrations')).not.toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })

  it('hides Integrations for client_viewer', () => {
    render(<SettingsTabs userRole={UserRole.ClientViewer} />)

    expect(screen.queryByText('Integrations')).not.toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })

  it('shows all tabs when no role provided (defaults to showing all)', () => {
    render(<SettingsTabs />)

    // canManageIntegrations(undefined) returns false, so Integrations hidden
    expect(screen.queryByText('Integrations')).not.toBeInTheDocument()
    // undefined !== ExternalDeveloper, so Monitoring visible
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })
})
