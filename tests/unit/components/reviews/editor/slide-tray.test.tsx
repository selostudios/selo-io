import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlideTray } from '@/components/reviews/editor/slide-tray'

describe('SlideTray', () => {
  test('toggling the handle collapses and expands the tray content', async () => {
    const user = userEvent.setup()
    render(
      <SlideTray defaultExpanded>
        <div data-testid="tray-body-content">body</div>
      </SlideTray>
    )
    const body = screen.getByTestId('tray-body')
    expect(body).toBeVisible()
    await user.click(screen.getByTestId('tray-handle'))
    expect(screen.getByTestId('tray-body')).not.toBeVisible()
  })

  test('starts collapsed when defaultExpanded is false', () => {
    render(
      <SlideTray defaultExpanded={false}>
        <div>body</div>
      </SlideTray>
    )
    expect(screen.getByTestId('tray-body')).not.toBeVisible()
  })

  test('renders children inside the body', () => {
    render(
      <SlideTray defaultExpanded>
        <div data-testid="tray-body-content">body content</div>
      </SlideTray>
    )
    expect(screen.getByTestId('tray-body-content')).toBeInTheDocument()
  })

  test('hides on :fullscreen via the fullscreen:hidden Tailwind variant', () => {
    const { container } = render(
      <SlideTray>
        <div />
      </SlideTray>
    )
    expect(container.firstChild).toHaveClass('fullscreen:hidden')
  })

  test('handle has aria-expanded reflecting collapse state', async () => {
    const user = userEvent.setup()
    render(
      <SlideTray defaultExpanded>
        <div />
      </SlideTray>
    )
    const handle = screen.getByTestId('tray-handle')
    expect(handle).toHaveAttribute('aria-expanded', 'true')
    await user.click(handle)
    expect(handle).toHaveAttribute('aria-expanded', 'false')
  })
})
