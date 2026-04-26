import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubtitleField } from '@/components/reviews/editor/fields/subtitle-field'
import { BulletsField } from '@/components/reviews/editor/fields/bullets-field'
import { ProseField } from '@/components/reviews/editor/fields/prose-field'

const cases = [
  { name: 'SubtitleField', Component: SubtitleField, expectedRows: 2 },
  { name: 'BulletsField', Component: BulletsField, expectedRows: 6 },
  { name: 'ProseField', Component: ProseField, expectedRows: 6 },
] as const

describe.each(cases)('$name', ({ Component, expectedRows }) => {
  test('renders label, hint, and textarea with the provided value', () => {
    render(
      <Component
        name="cover_subtitle"
        label="Cover subtitle"
        hint="One-liner"
        value="hello"
        onChange={() => {}}
      />
    )
    expect(screen.getByLabelText('Cover subtitle')).toBeInTheDocument()
    expect(screen.getByText('One-liner')).toBeInTheDocument()
    expect(screen.getByTestId('field-input-cover_subtitle')).toHaveValue('hello')
  })

  test('uses the variant-specific row count on the textarea', () => {
    render(<Component name="x" label="X" hint="" value="" onChange={() => {}} />)
    expect(screen.getByTestId('field-input-x')).toHaveAttribute('rows', String(expectedRows))
  })

  test('calls onChange with the new value on user input', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Component name="x" label="X" hint="" value="" onChange={handleChange} />)
    await user.type(screen.getByTestId('field-input-x'), 'a')
    expect(handleChange).toHaveBeenCalledWith('a')
  })

  test('renders the saving indicator when status is "saving"', () => {
    render(<Component name="x" label="X" hint="" value="" onChange={() => {}} status="saving" />)
    expect(screen.getByTestId('field-status-x')).toHaveTextContent(/saving/i)
  })

  test('renders the saved indicator when status is "saved"', () => {
    render(<Component name="x" label="X" hint="" value="" onChange={() => {}} status="saved" />)
    expect(screen.getByTestId('field-status-x')).toHaveTextContent(/saved/i)
  })

  test('renders the error message when status is "error"', () => {
    render(
      <Component
        name="x"
        label="X"
        hint=""
        value=""
        onChange={() => {}}
        status="error"
        errorMessage="boom"
      />
    )
    expect(screen.getByTestId('field-status-x')).toHaveTextContent('boom')
  })

  test('falls back to "Save failed" when status is "error" and no errorMessage is supplied', () => {
    render(<Component name="x" label="X" hint="" value="" onChange={() => {}} status="error" />)
    expect(screen.getByTestId('field-status-x')).toHaveTextContent(/save failed/i)
  })

  test('does not render any indicator when status is "idle" (or omitted)', () => {
    render(<Component name="x" label="X" hint="" value="" onChange={() => {}} />)
    expect(screen.queryByTestId('field-status-x')).not.toBeInTheDocument()
  })

  test('renders the character counter when limit is provided', () => {
    render(<Component name="x" label="X" hint="" value="hello" onChange={() => {}} limit={120} />)
    expect(screen.getByTestId('field-counter-x')).toHaveTextContent('5 / 120')
  })

  test('does not render the counter when limit is omitted', () => {
    render(<Component name="x" label="X" hint="" value="hello" onChange={() => {}} />)
    expect(screen.queryByTestId('field-counter-x')).not.toBeInTheDocument()
  })

  test('disables the textarea when disabled is true', () => {
    render(<Component name="x" label="X" hint="" value="" onChange={() => {}} disabled />)
    expect(screen.getByTestId('field-input-x')).toBeDisabled()
  })
})
