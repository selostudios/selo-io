import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIPlatform } from '@/lib/enums'
import { AIVisibilityEmptyState } from '@/components/ai-visibility/overview-dashboard'
import type { AIVisibilityConfig } from '@/lib/ai-visibility/types'

// Mock next/navigation for SyncButton (uses useRouter/useTransition)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock the sync action used by SyncButton
vi.mock('@/app/(authenticated)/[orgId]/ai-visibility/actions', () => ({
  runAIVisibilitySync: vi.fn(),
}))

function makeConfig(overrides: Partial<AIVisibilityConfig> = {}): AIVisibilityConfig {
  return {
    id: 'cfg-1',
    organization_id: 'org-1',
    platforms: [AIPlatform.ChatGPT, AIPlatform.Claude, AIPlatform.Perplexity],
    monthly_budget_cents: 10000,
    budget_alert_threshold: 90,
    last_alert_type: null,
    last_alert_sent_at: null,
    competitors: [],
    sync_frequency: 'daily',
    is_active: true,
    last_sync_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('AIVisibilityEmptyState', () => {
  const orgId = 'org-123'

  describe('with config and available platforms', () => {
    test('lists enabled platform names when all platforms are available', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={true}
          availablePlatforms={[AIPlatform.ChatGPT, AIPlatform.Claude, AIPlatform.Perplexity]}
        />
      )

      expect(screen.getByText('No visibility data yet')).toBeInTheDocument()
      expect(
        screen.getByText(/AI Visibility is enabled for ChatGPT, Claude, Perplexity/)
      ).toBeInTheDocument()
    })

    test('shows Sync Now button when config and platforms are available', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={false}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.getByRole('button', { name: /Sync Now/i })).toBeInTheDocument()
    })

    test('lists only the available platform when one platform is configured', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={false}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.getByText(/AI Visibility is enabled for Claude/)).toBeInTheDocument()
    })

    test('shows Add AI Models button for internal users when some platforms are missing', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={true}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      const addButton = screen.getByRole('link', { name: /Add AI Models/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('href', '/app-settings/integrations')
    })

    test('hides Add AI Models button for non-internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={false}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.queryByRole('link', { name: /Add AI Models/i })).not.toBeInTheDocument()
    })

    test('hides Add AI Models button when all platforms are available', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={true}
          availablePlatforms={[AIPlatform.ChatGPT, AIPlatform.Claude, AIPlatform.Perplexity]}
        />
      )

      expect(screen.queryByRole('link', { name: /Add AI Models/i })).not.toBeInTheDocument()
    })
  })

  describe('with config but no available platforms', () => {
    test('shows missing API keys message for internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={true}
          availablePlatforms={[]}
        />
      )

      expect(screen.getByText('No AI platform API keys configured')).toBeInTheDocument()
      expect(screen.getByText(/Add at least one AI platform API key/)).toBeInTheDocument()
    })

    test('shows contact admin message for non-internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={false}
          availablePlatforms={[]}
        />
      )

      expect(screen.getByText('No AI platform API keys configured')).toBeInTheDocument()
      expect(
        screen.getByText(/Contact your Selo admin to configure AI platform API keys/)
      ).toBeInTheDocument()
    })

    test('shows Add AI Models button for internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={true}
          availablePlatforms={[]}
        />
      )

      const addButton = screen.getByRole('link', { name: /Add AI Models/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('href', '/app-settings/integrations')
    })

    test('hides Add AI Models button for non-internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={false}
          availablePlatforms={[]}
        />
      )

      expect(screen.queryByRole('link', { name: /Add AI Models/i })).not.toBeInTheDocument()
    })

    test('does not show Sync Now button when no platforms are available', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={makeConfig()}
          isInternal={true}
          availablePlatforms={[]}
        />
      )

      expect(screen.queryByRole('button', { name: /Sync Now/i })).not.toBeInTheDocument()
    })
  })

  describe('without config but with available platforms', () => {
    test('shows ready state with available platform names', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={true}
          availablePlatforms={[AIPlatform.Claude, AIPlatform.ChatGPT]}
        />
      )

      expect(screen.getByText('AI Visibility ready')).toBeInTheDocument()
      expect(screen.getByText(/Claude, ChatGPT are available/)).toBeInTheDocument()
    })

    test('uses singular verb when only one platform is available', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={false}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.getByText(/Claude is available/)).toBeInTheDocument()
    })

    test('shows Enable AI Visibility button linking to org settings', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={false}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      const enableButton = screen.getByRole('link', { name: /Enable AI Visibility/i })
      expect(enableButton).toBeInTheDocument()
      expect(enableButton).toHaveAttribute('href', `/${orgId}/settings/organization`)
    })

    test('shows Add AI Models for internal users when some platforms are missing', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={true}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      const addButton = screen.getByRole('link', { name: /Add AI Models/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('href', '/app-settings/integrations')
    })

    test('hides Add AI Models for non-internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={false}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.queryByRole('link', { name: /Add AI Models/i })).not.toBeInTheDocument()
    })

    test('hides Add AI Models when all platforms are available', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={true}
          availablePlatforms={[AIPlatform.ChatGPT, AIPlatform.Claude, AIPlatform.Perplexity]}
        />
      )

      expect(screen.queryByRole('link', { name: /Add AI Models/i })).not.toBeInTheDocument()
    })

    test('does not show Sync Now button without config', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={true}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.queryByRole('button', { name: /Sync Now/i })).not.toBeInTheDocument()
    })
  })

  describe('without config and no available platforms', () => {
    test('shows fully unconfigured state for internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={true}
          availablePlatforms={[]}
        />
      )

      expect(screen.getByText('AI Visibility not configured')).toBeInTheDocument()
      expect(
        screen.getByText(/Configure AI platform API keys to start tracking/)
      ).toBeInTheDocument()
    })

    test('shows contact admin message for non-internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={false}
          availablePlatforms={[]}
        />
      )

      expect(screen.getByText('AI Visibility not configured')).toBeInTheDocument()
      expect(
        screen.getByText(/Contact your Selo admin to enable AI Visibility/)
      ).toBeInTheDocument()
    })

    test('shows Add AI Models button for internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={true}
          availablePlatforms={[]}
        />
      )

      const addButton = screen.getByRole('link', { name: /Add AI Models/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('href', '/app-settings/integrations')
    })

    test('hides Add AI Models button for non-internal users', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={false}
          availablePlatforms={[]}
        />
      )

      expect(screen.queryByRole('link', { name: /Add AI Models/i })).not.toBeInTheDocument()
    })

    test('does not show Sync Now or Enable AI Visibility buttons', () => {
      render(
        <AIVisibilityEmptyState
          orgId={orgId}
          config={null}
          isInternal={true}
          availablePlatforms={[]}
        />
      )

      expect(screen.queryByRole('button', { name: /Sync Now/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Enable AI Visibility/i })).not.toBeInTheDocument()
    })
  })
})
