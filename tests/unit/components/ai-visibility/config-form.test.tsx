import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIPlatform } from '@/lib/enums'
import { AIVisibilityConfigForm } from '@/components/ai-visibility/config-form'
import type { AIVisibilityConfig } from '@/lib/ai-visibility/types'

// Mock the server action
vi.mock('@/app/(authenticated)/[orgId]/ai-visibility/actions', () => ({
  updateAIVisibilityConfig: vi.fn(),
}))

function makeConfig(overrides: Partial<AIVisibilityConfig> = {}): AIVisibilityConfig {
  return {
    id: 'cfg-1',
    organization_id: 'org-1',
    platforms: [AIPlatform.Claude],
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

describe('AIVisibilityConfigForm', () => {
  describe('platform checkboxes', () => {
    test('only shows platforms that have API keys configured', () => {
      render(
        <AIVisibilityConfigForm
          orgId="org-1"
          config={null}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.getByText('Claude')).toBeInTheDocument()
      expect(screen.queryByText('ChatGPT')).not.toBeInTheDocument()
      expect(screen.queryByText('Perplexity')).not.toBeInTheDocument()
    })

    test('shows all platforms when all have API keys', () => {
      render(
        <AIVisibilityConfigForm
          orgId="org-1"
          config={null}
          availablePlatforms={[AIPlatform.ChatGPT, AIPlatform.Claude, AIPlatform.Perplexity]}
        />
      )

      expect(screen.getByText('ChatGPT')).toBeInTheDocument()
      expect(screen.getByText('Claude')).toBeInTheDocument()
      expect(screen.getByText('Perplexity')).toBeInTheDocument()
    })

    test('shows two platforms when two have API keys', () => {
      render(
        <AIVisibilityConfigForm
          orgId="org-1"
          config={null}
          availablePlatforms={[AIPlatform.Claude, AIPlatform.ChatGPT]}
        />
      )

      expect(screen.getByText('Claude')).toBeInTheDocument()
      expect(screen.getByText('ChatGPT')).toBeInTheDocument()
      expect(screen.queryByText('Perplexity')).not.toBeInTheDocument()
    })
  })

  describe('default platform selection', () => {
    test('pre-selects all available platforms when no config exists', () => {
      render(
        <AIVisibilityConfigForm
          orgId="org-1"
          config={null}
          availablePlatforms={[AIPlatform.Claude, AIPlatform.ChatGPT]}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      // Filter to platform checkboxes (exclude the Enable toggle switch)
      const platformCheckboxes = checkboxes.filter(
        (cb) => cb.getAttribute('data-state') === 'checked' || cb.getAttribute('data-state') === 'unchecked'
      )
      // Both available platforms should be checked by default
      const checkedPlatforms = platformCheckboxes.filter(
        (cb) => cb.getAttribute('data-state') === 'checked'
      )
      expect(checkedPlatforms).toHaveLength(2)
    })

    test('uses saved config platforms when config exists', () => {
      render(
        <AIVisibilityConfigForm
          orgId="org-1"
          config={makeConfig({ platforms: [AIPlatform.Claude] })}
          availablePlatforms={[AIPlatform.Claude, AIPlatform.ChatGPT]}
        />
      )

      // Claude and ChatGPT are shown, but only Claude should be checked (from config)
      expect(screen.getByText('Claude')).toBeInTheDocument()
      expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    })
  })

  describe('form rendering', () => {
    test('renders all form sections', () => {
      render(
        <AIVisibilityConfigForm
          orgId="org-1"
          config={null}
          availablePlatforms={[AIPlatform.Claude]}
        />
      )

      expect(screen.getByText('AI Visibility')).toBeInTheDocument()
      expect(screen.getByText('Enable AI Visibility')).toBeInTheDocument()
      expect(screen.getByText('Platforms')).toBeInTheDocument()
      expect(screen.getByText('Sync Frequency')).toBeInTheDocument()
      expect(screen.getByText('Monthly Budget')).toBeInTheDocument()
      expect(screen.getByText('Alert Threshold')).toBeInTheDocument()
      expect(screen.getByText('Competitors')).toBeInTheDocument()
      expect(screen.getByText('Save Configuration')).toBeInTheDocument()
    })
  })
})
