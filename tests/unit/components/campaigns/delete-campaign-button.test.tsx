import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeleteCampaignButton } from '@/components/campaigns/delete-campaign-button'

describe('DeleteCampaignButton', () => {
  const mockOnDelete = vi.fn()

  it('renders delete button when user is admin', () => {
    render(<DeleteCampaignButton isAdmin={true} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByRole('button', { name: /delete campaign/i })
    expect(deleteButton).toBeInTheDocument()
  })

  it('does not render delete button when user is not admin', () => {
    render(<DeleteCampaignButton isAdmin={false} onDelete={mockOnDelete} />)

    const deleteButton = screen.queryByRole('button', { name: /delete campaign/i })
    expect(deleteButton).not.toBeInTheDocument()
  })
})
