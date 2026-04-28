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
    render(<Component name="ga_summary" label="GA summary" value="" onChange={() => {}} />)
    expect(screen.getByTestId('field-input-ga_summary')).toHaveAttribute(
      'rows',
      String(expectedRows)
    )
  })

  test('calls onChange with the new value on user input', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Component name="initiatives" label="Initiatives" value="" onChange={handleChange} />)
    await user.type(screen.getByTestId('field-input-initiatives'), 'a')
    expect(handleChange).toHaveBeenCalledWith('a')
  })

  test('shows a saving indicator while a save is in flight', () => {
    render(
      <Component
        name="ga_summary"
        label="GA summary"
        value=""
        onChange={() => {}}
        status="saving"
      />
    )
    expect(screen.getByTestId('field-status-ga_summary')).toHaveTextContent(/saving/i)
  })

  test('shows a saved indicator after a successful save', () => {
    render(
      <Component name="ga_summary" label="GA summary" value="" onChange={() => {}} status="saved" />
    )
    expect(screen.getByTestId('field-status-ga_summary')).toHaveTextContent(/saved/i)
  })

  test('shows the error message when a save fails', () => {
    render(
      <Component
        name="takeaways"
        label="Takeaways"
        value=""
        onChange={() => {}}
        status="error"
        errorMessage="boom"
      />
    )
    expect(screen.getByTestId('field-status-takeaways')).toHaveTextContent('boom')
  })

  test('falls back to "Save failed" when status is "error" and no errorMessage is supplied', () => {
    render(
      <Component name="takeaways" label="Takeaways" value="" onChange={() => {}} status="error" />
    )
    expect(screen.getByTestId('field-status-takeaways')).toHaveTextContent(/save failed/i)
  })

  test('shows no indicator when the field is idle', () => {
    render(<Component name="planning" label="Planning" value="" onChange={() => {}} />)
    expect(screen.queryByTestId('field-status-planning')).not.toBeInTheDocument()
  })

  test('renders the character counter when limit is provided', () => {
    render(
      <Component
        name="cover_subtitle"
        label="Cover subtitle"
        value="hello"
        onChange={() => {}}
        limit={120}
      />
    )
    expect(screen.getByTestId('field-counter-cover_subtitle')).toHaveTextContent('5 / 120')
  })

  test('does not render the counter when limit is omitted', () => {
    render(
      <Component name="cover_subtitle" label="Cover subtitle" value="hello" onChange={() => {}} />
    )
    expect(screen.queryByTestId('field-counter-cover_subtitle')).not.toBeInTheDocument()
  })

  test('disables the textarea when disabled is true', () => {
    render(<Component name="planning" label="Planning" value="" onChange={() => {}} disabled />)
    expect(screen.getByTestId('field-input-planning')).toBeDisabled()
  })

  test('announces save status changes to assistive tech via role="status" + aria-live="polite"', () => {
    render(
      <Component
        name="ga_summary"
        label="GA summary"
        value=""
        onChange={() => {}}
        status="saving"
      />
    )
    const statusEl = screen.getByTestId('field-status-ga_summary')
    expect(statusEl).toHaveAttribute('role', 'status')
    expect(statusEl).toHaveAttribute('aria-live', 'polite')
  })
})

describe('SubtitleField', () => {
  test('renders no placeholder', () => {
    render(
      <SubtitleField name="cover_subtitle" label="Cover subtitle" value="" onChange={() => {}} />
    )
    expect(screen.getByTestId('field-input-cover_subtitle')).not.toHaveAttribute('placeholder')
  })

  test('uses the supplied name on the wrapper testid', () => {
    render(
      <SubtitleField name="cover_subtitle" label="Cover subtitle" value="" onChange={() => {}} />
    )
    expect(screen.getByTestId('field-cover_subtitle')).toBeInTheDocument()
  })
})

describe('BulletsField', () => {
  test('renders the default "• One bullet per line" placeholder', () => {
    render(<BulletsField name="initiatives" label="Initiatives" value="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText('• One bullet per line')).toBeInTheDocument()
  })
})

describe('ProseField', () => {
  test('renders no placeholder', () => {
    render(<ProseField name="ga_summary" label="GA summary" value="" onChange={() => {}} />)
    expect(screen.getByTestId('field-input-ga_summary')).not.toHaveAttribute('placeholder')
  })
})
