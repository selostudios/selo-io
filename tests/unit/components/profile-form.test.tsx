import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileForm } from '@/components/settings/profile-form'

describe('ProfileForm', () => {
  const defaultProps = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
  }

  it('renders form with initial values', () => {
    render(<ProfileForm {...defaultProps} />)

    expect(screen.getByDisplayValue('John')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })

  it('disables email field', () => {
    render(<ProfileForm {...defaultProps} />)

    const emailInput = screen.getByLabelText(/email/i)
    expect(emailInput).toBeDisabled()
  })

  it('validates first name minimum length', () => {
    render(<ProfileForm {...defaultProps} />)

    const firstNameInput = screen.getByLabelText(/first name/i)
    fireEvent.change(firstNameInput, { target: { value: 'A' } })

    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument()
  })

  it('disables save when no changes made', () => {
    render(<ProfileForm {...defaultProps} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })

  it('enables save when name is changed', async () => {
    render(<ProfileForm {...defaultProps} />)

    const firstNameInput = screen.getByLabelText(/first name/i)
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
  })
})
