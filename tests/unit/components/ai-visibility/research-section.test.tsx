import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResearchSection } from '@/components/ai-visibility/research-section'

// Mock the polling hook
vi.mock('@/hooks/use-polling', () => ({
  usePolling: vi.fn(() => ({ data: null, isLoading: false })),
}))

// Mock the add prompt dialog
vi.mock('@/components/ai-visibility/add-prompt-dialog', () => ({
  AddPromptDialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

describe('ResearchSection', () => {
  test('renders input and run button', () => {
    render(
      <ResearchSection
        orgId="org-1"
        orgName="Acme"
        websiteUrl="https://acme.com"
        competitors={[]}
        existingTopics={[]}
        monthlySpendCents={500}
        monthlyBudgetCents={10000}
      />
    )

    expect(screen.getByPlaceholderText(/type a prompt/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /run/i })).toBeDefined()
  })

  test('shows budget info', () => {
    render(
      <ResearchSection
        orgId="org-1"
        orgName="Acme"
        websiteUrl="https://acme.com"
        competitors={[]}
        existingTopics={[]}
        monthlySpendCents={5000}
        monthlyBudgetCents={10000}
      />
    )

    expect(screen.getByText(/\$50\.00/)).toBeDefined()
    expect(screen.getByText(/\$100\.00/)).toBeDefined()
  })

  test('disables run button when input is empty', () => {
    render(
      <ResearchSection
        orgId="org-1"
        orgName="Acme"
        websiteUrl="https://acme.com"
        competitors={[]}
        existingTopics={[]}
        monthlySpendCents={500}
        monthlyBudgetCents={10000}
      />
    )

    const button = screen.getByRole('button', { name: /run/i })
    expect(button).toHaveProperty('disabled', true)
  })
})
