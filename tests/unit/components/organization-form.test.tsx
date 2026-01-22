import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrganizationForm } from '@/components/settings/organization-form'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}))

describe('OrganizationForm', () => {
  const mockIndustries = [
    { id: 'industry-1', name: 'Marketing' },
    { id: 'industry-2', name: 'Software' },
  ]

  const defaultProps = {
    organizationId: 'org-1',
    name: 'Test Org',
    industryId: 'industry-1',
    logoUrl: '',
    primaryColor: '#000000',
    secondaryColor: '#F5F5F0',
    accentColor: '#666666',
    industries: mockIndustries,
    websiteUrl: '',
    existingAuditCount: 0,
    description: '',
    city: '',
    country: '',
    socialLinks: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with initial values', () => {
    render(<OrganizationForm {...defaultProps} />)

    expect(screen.getByDisplayValue('Test Org')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('disables save button when no changes made', () => {
    render(<OrganizationForm {...defaultProps} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })

  it('enables save button when form is modified', async () => {
    render(<OrganizationForm {...defaultProps} />)

    const nameInput = screen.getByLabelText(/organization name/i)
    fireEvent.change(nameInput, { target: { value: 'Updated Org' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
  })

  it('validates organization name is required', () => {
    render(<OrganizationForm {...defaultProps} />)

    const nameInput = screen.getByLabelText(/organization name/i)
    fireEvent.change(nameInput, { target: { value: '' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })
})
