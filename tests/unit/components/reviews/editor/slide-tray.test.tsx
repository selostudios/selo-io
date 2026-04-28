import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlideTray } from '@/components/reviews/editor/slide-tray'

describe('SlideTray', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('starts expanded by default and collapses when the handle is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SlideTray defaultExpanded>
        <div>body</div>
      </SlideTray>
    )

    const body = screen.getByTestId('tray-body')
    expect(body).not.toHaveClass('hidden')

    await user.click(screen.getByTestId('tray-handle'))
    expect(screen.getByTestId('tray-body')).toHaveClass('hidden')
  })

  test('clicking the handle a second time re-expands the tray', async () => {
    const user = userEvent.setup()
    render(
      <SlideTray defaultExpanded>
        <div>body</div>
      </SlideTray>
    )
    const handle = screen.getByTestId('tray-handle')

    await user.click(handle)
    expect(screen.getByTestId('tray-body')).toHaveClass('hidden')

    await user.click(handle)
    expect(screen.getByTestId('tray-body')).not.toHaveClass('hidden')
  })

  test('starts collapsed when defaultExpanded is false', () => {
    render(
      <SlideTray defaultExpanded={false}>
        <div>body</div>
      </SlideTray>
    )
    expect(screen.getByTestId('tray-body')).toHaveClass('hidden')
  })

  test('keeps the body mounted in the DOM when collapsed', () => {
    render(
      <SlideTray defaultExpanded={false}>
        <div data-testid="tray-body-content">body content</div>
      </SlideTray>
    )

    // The body must remain in the DOM (not unmounted) so its content keeps
    // its state and is available to assistive tech / scripted access.
    expect(screen.queryByTestId('tray-body')).not.toBeNull()
    expect(screen.queryByTestId('tray-body-content')).not.toBeNull()
  })

  test('renders children inside the body', () => {
    render(
      <SlideTray defaultExpanded>
        <div data-testid="tray-body-content">body content</div>
      </SlideTray>
    )
    expect(screen.getByTestId('tray-body-content')).toBeInTheDocument()
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

  test('restores collapsed state from a previous session', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <SlideTray defaultExpanded>
        <div />
      </SlideTray>
    )
    await user.click(screen.getByTestId('tray-handle'))
    expect(screen.getByTestId('tray-body')).toHaveClass('hidden')
    unmount()

    // Simulate navigating to a sibling slide: a fresh mount with the same
    // default should pick up the persisted "collapsed" preference.
    render(
      <SlideTray defaultExpanded>
        <div />
      </SlideTray>
    )
    expect(screen.getByTestId('tray-body')).toHaveClass('hidden')
  })
})
