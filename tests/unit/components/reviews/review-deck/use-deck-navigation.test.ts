import { describe, test, expect } from 'vitest'
import { renderHook, act, render, fireEvent } from '@testing-library/react'
import React from 'react'
import { useDeckNavigation } from '@/components/reviews/review-deck/use-deck-navigation'

describe('useDeckNavigation', () => {
  test('starts on the first slide', () => {
    const { result } = renderHook(() => useDeckNavigation(6))

    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isFirst).toBe(true)
    expect(result.current.isLast).toBe(false)
  })

  test('advances one slide at a time when next is called', () => {
    const { result } = renderHook(() => useDeckNavigation(3))

    act(() => result.current.next())
    expect(result.current.currentIndex).toBe(1)

    act(() => result.current.next())
    expect(result.current.currentIndex).toBe(2)
  })

  test('does not advance past the last slide', () => {
    const { result } = renderHook(() => useDeckNavigation(2))

    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.next())

    expect(result.current.currentIndex).toBe(1)
    expect(result.current.isLast).toBe(true)
  })

  test('goes back one slide at a time when prev is called', () => {
    const { result } = renderHook(() => useDeckNavigation(3))

    act(() => result.current.goTo(2))
    act(() => result.current.prev())
    expect(result.current.currentIndex).toBe(1)

    act(() => result.current.prev())
    expect(result.current.currentIndex).toBe(0)
  })

  test('does not go before the first slide', () => {
    const { result } = renderHook(() => useDeckNavigation(3))

    act(() => result.current.prev())
    act(() => result.current.prev())

    expect(result.current.currentIndex).toBe(0)
    expect(result.current.isFirst).toBe(true)
  })

  test('clamps goTo targets to the valid range', () => {
    const { result } = renderHook(() => useDeckNavigation(4))

    act(() => result.current.goTo(-5))
    expect(result.current.currentIndex).toBe(0)

    act(() => result.current.goTo(99))
    expect(result.current.currentIndex).toBe(3)
  })

  test('floors fractional goTo targets to the nearest slide', () => {
    const { result } = renderHook(() => useDeckNavigation(5))

    act(() => result.current.goTo(2.7))
    expect(result.current.currentIndex).toBe(2)

    act(() => result.current.goTo(3.999))
    expect(result.current.currentIndex).toBe(3)
  })

  test('reports isFirst and isLast based on current position', () => {
    const { result } = renderHook(() => useDeckNavigation(3))

    expect(result.current.isFirst).toBe(true)
    expect(result.current.isLast).toBe(false)

    act(() => result.current.goTo(1))
    expect(result.current.isFirst).toBe(false)
    expect(result.current.isLast).toBe(false)

    act(() => result.current.goTo(2))
    expect(result.current.isFirst).toBe(false)
    expect(result.current.isLast).toBe(true)
  })

  describe('keyboard navigation', () => {
    test('ArrowRight advances to the next slide', () => {
      const { result } = renderHook(() => useDeckNavigation(3))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      })

      expect(result.current.currentIndex).toBe(1)
    })

    test('Space advances to the next slide', () => {
      const { result } = renderHook(() => useDeckNavigation(3))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
      })

      expect(result.current.currentIndex).toBe(1)
    })

    test('PageDown advances to the next slide', () => {
      const { result } = renderHook(() => useDeckNavigation(3))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
      })

      expect(result.current.currentIndex).toBe(1)
    })

    test('ArrowLeft returns to the previous slide', () => {
      const { result } = renderHook(() => useDeckNavigation(3))

      act(() => result.current.goTo(2))
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
      })

      expect(result.current.currentIndex).toBe(1)
    })

    test('PageUp returns to the previous slide', () => {
      const { result } = renderHook(() => useDeckNavigation(3))

      act(() => result.current.goTo(2))
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp' }))
      })

      expect(result.current.currentIndex).toBe(1)
    })

    test('Home jumps to the first slide from the middle', () => {
      const { result } = renderHook(() => useDeckNavigation(5))

      act(() => result.current.goTo(3))
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))
      })

      expect(result.current.currentIndex).toBe(0)
    })

    test('End jumps to the last slide from the middle', () => {
      const { result } = renderHook(() => useDeckNavigation(5))

      act(() => result.current.goTo(2))
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
      })

      expect(result.current.currentIndex).toBe(4)
    })

    test('calls preventDefault for handled keys', () => {
      renderHook(() => useDeckNavigation(3))

      const handledKeys = ['ArrowRight', ' ', 'PageDown', 'ArrowLeft', 'PageUp', 'Home', 'End']
      for (const key of handledKeys) {
        const event = new KeyboardEvent('keydown', { key, cancelable: true })
        act(() => {
          window.dispatchEvent(event)
        })
        expect(event.defaultPrevented, `key ${key} should be prevented`).toBe(true)
      }
    })

    test('ignores unrelated keys without calling preventDefault', () => {
      const { result } = renderHook(() => useDeckNavigation(3))

      const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true })
      act(() => {
        window.dispatchEvent(event)
      })

      expect(result.current.currentIndex).toBe(0)
      expect(event.defaultPrevented).toBe(false)
    })

    test('ignores keyboard events when focus is inside an input', () => {
      function Harness({ slideCount }: { slideCount: number }) {
        const nav = useDeckNavigation(slideCount)
        return React.createElement(
          'div',
          null,
          React.createElement('input', {
            'data-testid': 'text-input',
            type: 'text',
          }),
          React.createElement('span', { 'data-testid': 'index' }, String(nav.currentIndex))
        )
      }

      const { getByTestId } = render(React.createElement(Harness, { slideCount: 3 }))
      const input = getByTestId('text-input') as HTMLInputElement
      input.focus()

      // fireEvent.keyDown on the focused element sets event.target to the input.
      fireEvent.keyDown(input, { key: 'ArrowRight' })

      expect(getByTestId('index').textContent).toBe('0')
    })

    test('ignores keyboard events when focus is inside a textarea', () => {
      function Harness({ slideCount }: { slideCount: number }) {
        const nav = useDeckNavigation(slideCount)
        return React.createElement(
          'div',
          null,
          React.createElement('textarea', {
            'data-testid': 'text-area',
          }),
          React.createElement('span', { 'data-testid': 'index' }, String(nav.currentIndex))
        )
      }

      const { getByTestId } = render(React.createElement(Harness, { slideCount: 3 }))
      const textarea = getByTestId('text-area') as HTMLTextAreaElement
      textarea.focus()

      fireEvent.keyDown(textarea, { key: 'ArrowRight' })

      expect(getByTestId('index').textContent).toBe('0')
    })

    test('ignores keyboard events when focus is inside a contentEditable element', () => {
      function Harness({ slideCount }: { slideCount: number }) {
        const nav = useDeckNavigation(slideCount)
        return React.createElement(
          'div',
          null,
          React.createElement('div', {
            'data-testid': 'editable',
            contentEditable: true,
            suppressContentEditableWarning: true,
          }),
          React.createElement('span', { 'data-testid': 'index' }, String(nav.currentIndex))
        )
      }

      const { getByTestId } = render(React.createElement(Harness, { slideCount: 3 }))
      const editable = getByTestId('editable') as HTMLDivElement
      editable.focus()

      fireEvent.keyDown(editable, { key: 'ArrowRight' })

      expect(getByTestId('index').textContent).toBe('0')
    })

    test('removes the keyboard listener on unmount', () => {
      const { result, unmount } = renderHook(() => useDeckNavigation(3))

      act(() => result.current.goTo(1))
      expect(result.current.currentIndex).toBe(1)

      const snapshotIndex = result.current.currentIndex
      unmount()

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      })

      // After unmount, the hook no longer updates — the last observed index stays the same.
      expect(result.current.currentIndex).toBe(snapshotIndex)
    })
  })

  describe('slideCount changes', () => {
    test('clamps currentIndex when slideCount shrinks below it', () => {
      const { result, rerender } = renderHook(
        ({ slideCount }: { slideCount: number }) => useDeckNavigation(slideCount),
        { initialProps: { slideCount: 6 } }
      )

      act(() => result.current.goTo(5))
      expect(result.current.currentIndex).toBe(5)

      rerender({ slideCount: 3 })

      expect(result.current.currentIndex).toBe(2)
      expect(result.current.isLast).toBe(true)
    })

    test('prev after shrink navigates from the clamped position, not the old stored one', () => {
      const { result, rerender } = renderHook(
        ({ slideCount }: { slideCount: number }) => useDeckNavigation(slideCount),
        { initialProps: { slideCount: 6 } }
      )

      act(() => result.current.goTo(5))
      rerender({ slideCount: 3 })
      expect(result.current.currentIndex).toBe(2)

      // prev should step back from index 2 (the clamped position), not from
      // the original index 5 that was stored before shrinking.
      act(() => result.current.prev())
      expect(result.current.currentIndex).toBe(1)
    })
  })

  describe('empty deck', () => {
    test('reports both isFirst and isLast as true when slideCount is zero', () => {
      const { result } = renderHook(() => useDeckNavigation(0))

      expect(result.current.isFirst).toBe(true)
      expect(result.current.isLast).toBe(true)
    })

    test('next, prev, and goTo are no-ops on an empty deck', () => {
      const { result } = renderHook(() => useDeckNavigation(0))

      act(() => result.current.next())
      act(() => result.current.prev())
      act(() => result.current.goTo(3))

      expect(result.current.currentIndex).toBe(0)
      expect(result.current.isFirst).toBe(true)
      expect(result.current.isLast).toBe(true)
    })

    test('keyboard shortcuts do not change state on an empty deck', () => {
      const { result } = renderHook(() => useDeckNavigation(0))

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
      })

      expect(result.current.currentIndex).toBe(0)
    })
  })
})
