import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeleteCampaignButton } from '@/components/campaigns/delete-campaign-button'

describe('DeleteCampaignButton', () => {
  const mockOnDelete = vi.fn()

  it('renders delete button when user can delete campaigns', () => {
    render(<DeleteCampaignButton canDelete={true} onDelete={mockOnDelete} />)

    const deleteButton = screen.getByRole('button', { name: /delete campaign/i })
    expect(deleteButton).toBeInTheDocument()
  })

  it('does not render delete button when user cannot delete campaigns', () => {
    render(<DeleteCampaignButton canDelete={false} onDelete={mockOnDelete} />)

    const deleteButton = screen.queryByRole('button', { name: /delete campaign/i })
    expect(deleteButton).not.toBeInTheDocument()
  })
})
