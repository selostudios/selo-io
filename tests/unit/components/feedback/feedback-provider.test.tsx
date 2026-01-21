import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedbackProvider, useFeedback } from '@/components/feedback/feedback-provider'

function TestComponent() {
  const { isOpen, openFeedback, closeFeedback } = useFeedback()
  return (
    <div>
      <span data-testid="status">{isOpen ? 'open' : 'closed'}</span>
      <button onClick={openFeedback}>Open</button>
      <button onClick={closeFeedback}>Close</button>
    </div>
  )
}

describe('FeedbackProvider', () => {
  it('provides initial closed state', () => {
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    )

    expect(screen.getByTestId('status')).toHaveTextContent('closed')
  })

  it('opens feedback dialog', () => {
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    )

    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('status')).toHaveTextContent('open')
  })

  it('closes feedback dialog', () => {
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    )

    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Close'))
    expect(screen.getByTestId('status')).toHaveTextContent('closed')
  })

  it('throws error when used outside provider', () => {
    const consoleError = console.error
    console.error = () => {} // Suppress error output

    expect(() => render(<TestComponent />)).toThrow(
      'useFeedback must be used within a FeedbackProvider'
    )

    console.error = consoleError
  })
})
