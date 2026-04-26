import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StyleMemoButton } from '@/components/reviews/editor/style-memo-button'

describe('StyleMemoButton', () => {
  test('renders a trigger button labelled for style memo with the brain icon', () => {
    render(<StyleMemoButton orgId="org-1" memo="" updatedAt={null} />)

    const trigger = screen.getByTestId('style-memo-button')
    expect(trigger).toHaveAttribute('aria-label', 'Style memo')
  })

  test('does not show popover content until the trigger is clicked', () => {
    render(<StyleMemoButton orgId="org-1" memo="The memo body." updatedAt={null} />)

    expect(screen.queryByTestId('style-memo-popover')).not.toBeInTheDocument()
  })

  test('opens the popover when the trigger is clicked, showing the populated memo and a settings link', async () => {
    const user = userEvent.setup()
    render(
      <StyleMemoButton
        orgId="org-1"
        memo="Lead with the punchy headline."
        updatedAt="2026-04-20T12:00:00.000Z"
      />
    )

    await user.click(screen.getByTestId('style-memo-button'))

    const popover = await screen.findByTestId('style-memo-popover')
    expect(popover).toHaveTextContent('Lead with the punchy headline.')
    expect(popover).toHaveTextContent(/updated/i)

    const editLink = screen.getByRole('link', { name: /edit in settings/i })
    expect(editLink).toHaveAttribute('href', '/org-1/reports/performance/settings')
  })

  test('shows an empty-state message and hides the settings link when the memo is empty', async () => {
    const user = userEvent.setup()
    render(<StyleMemoButton orgId="org-1" memo="   " updatedAt={null} />)

    await user.click(screen.getByTestId('style-memo-button'))

    const popover = await screen.findByTestId('style-memo-popover')
    expect(popover).toHaveTextContent(/style memo empty/i)
    expect(screen.queryByRole('link', { name: /edit in settings/i })).not.toBeInTheDocument()
  })
})
