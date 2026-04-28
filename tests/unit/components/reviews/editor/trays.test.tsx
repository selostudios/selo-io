import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

vi.useFakeTimers()
vi.mock('@/lib/reviews/actions', () => ({
  updateNarrative: vi.fn().mockResolvedValue({ success: true }),
  updateSlideNote: vi.fn().mockResolvedValue({ success: true }),
}))

import { CoverTrayEditor } from '@/components/reviews/editor/trays/cover-tray-editor'
import { GaTrayEditor } from '@/components/reviews/editor/trays/ga-tray-editor'
import { LinkedInTrayEditor } from '@/components/reviews/editor/trays/linkedin-tray-editor'
import { ContentTrayEditor } from '@/components/reviews/editor/trays/content-tray-editor'
import { ProseTrayEditor } from '@/components/reviews/editor/trays/prose-tray-editor'
import { updateNarrative } from '@/lib/reviews/actions'

beforeEach(() => {
  vi.mocked(updateNarrative).mockClear()
})

describe('tray editors', () => {
  test('CoverTrayEditor autosaves on cover_subtitle', async () => {
    render(<CoverTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} />)
    fireEvent.change(screen.getByTestId('field-input-cover_subtitle'), {
      target: { value: 'Hello' },
    })
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).toHaveBeenCalledWith('rev-1', 'cover_subtitle', 'Hello')
  })

  test('GaTrayEditor autosaves on ga_summary', async () => {
    render(<GaTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} />)
    fireEvent.change(screen.getByTestId('field-input-ga_summary'), {
      target: { value: 'Sessions' },
    })
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).toHaveBeenCalledWith('rev-1', 'ga_summary', 'Sessions')
  })

  test('LinkedInTrayEditor autosaves on linkedin_insights', async () => {
    render(<LinkedInTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} />)
    fireEvent.change(screen.getByTestId('field-input-linkedin_insights'), {
      target: { value: 'Followers' },
    })
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).toHaveBeenCalledWith('rev-1', 'linkedin_insights', 'Followers')
  })

  test('ContentTrayEditor autosaves on content_highlights', async () => {
    render(<ContentTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} />)
    fireEvent.change(screen.getByTestId('field-input-content_highlights'), {
      target: { value: 'Top post' },
    })
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).toHaveBeenCalledWith('rev-1', 'content_highlights', 'Top post')
  })

  test.each(['initiatives', 'takeaways', 'planning'] as const)(
    'ProseTrayEditor with slideKey=%s autosaves on that block',
    async (slideKey) => {
      render(
        <ProseTrayEditor
          reviewId="rev-1"
          slideKey={slideKey}
          initialValue=""
          noteInitialValue={null}
        />
      )
      fireEvent.change(screen.getByTestId(`field-input-${slideKey}`), { target: { value: 'x' } })
      await act(async () => {
        vi.advanceTimersByTime(1500)
      })
      expect(updateNarrative).toHaveBeenCalledWith('rev-1', slideKey, 'x')
    }
  )

  test.each([
    [
      'CoverTrayEditor',
      () => <CoverTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} disabled />,
      'cover_subtitle',
    ],
    [
      'GaTrayEditor',
      () => <GaTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} disabled />,
      'ga_summary',
    ],
    [
      'LinkedInTrayEditor',
      () => (
        <LinkedInTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} disabled />
      ),
      'linkedin_insights',
    ],
    [
      'ContentTrayEditor',
      () => <ContentTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} disabled />,
      'content_highlights',
    ],
    [
      'ProseTrayEditor',
      () => (
        <ProseTrayEditor
          reviewId="rev-1"
          slideKey="initiatives"
          initialValue=""
          noteInitialValue={null}
          disabled
        />
      ),
      'initiatives',
    ],
  ] as const)(
    '%s propagates disabled to the underlying textarea',
    (_name, renderTray, fieldKey) => {
      render(renderTray())
      expect(screen.getByTestId(`field-input-${fieldKey}`)).toBeDisabled()
    }
  )

  test('ProseTrayEditor renders the correct label per slideKey', () => {
    const { rerender } = render(
      <ProseTrayEditor
        reviewId="rev-1"
        slideKey="initiatives"
        initialValue=""
        noteInitialValue={null}
      />
    )
    expect(screen.getByLabelText('Initiatives')).toBeInTheDocument()
    rerender(
      <ProseTrayEditor
        reviewId="rev-1"
        slideKey="takeaways"
        initialValue=""
        noteInitialValue={null}
      />
    )
    expect(screen.getByLabelText('Takeaways')).toBeInTheDocument()
    rerender(
      <ProseTrayEditor
        reviewId="rev-1"
        slideKey="planning"
        initialValue=""
        noteInitialValue={null}
      />
    )
    expect(screen.getByLabelText('Planning ahead')).toBeInTheDocument()
  })

  test('hides the SlideNoteButton when noteInitialValue is null (non-admin)', () => {
    render(<GaTrayEditor reviewId="rev-1" initialValue="" noteInitialValue={null} />)
    expect(screen.queryByTestId('slide-note-button-ga_summary')).not.toBeInTheDocument()
  })

  test('renders the SlideNoteButton when noteInitialValue is a string (admin)', () => {
    render(<GaTrayEditor reviewId="rev-1" initialValue="" noteInitialValue="" />)
    expect(screen.getByTestId('slide-note-button-ga_summary')).toBeInTheDocument()
  })
})
