import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const saveStyleMemo = vi.fn()
const clearStyleMemo = vi.fn()
const regenerateStyleMemoFromLatestSnapshot = vi.fn()

vi.mock('@/lib/reviews/narrative/style-memo-actions', () => ({
  saveStyleMemo: (...args: unknown[]) => saveStyleMemo(...args),
  clearStyleMemo: (...args: unknown[]) => clearStyleMemo(...args),
  regenerateStyleMemoFromLatestSnapshot: (...args: unknown[]) =>
    regenerateStyleMemoFromLatestSnapshot(...args),
}))

const routerRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), back: vi.fn() }),
}))

import { StyleMemoCard } from '@/app/(authenticated)/[orgId]/reports/performance/settings/style-memo-card'

const ORG_ID = '11111111-1111-1111-1111-111111111111'

describe('StyleMemoCard', () => {
  beforeEach(() => {
    saveStyleMemo.mockReset()
    clearStyleMemo.mockReset()
    regenerateStyleMemoFromLatestSnapshot.mockReset()
    routerRefresh.mockReset()
  })

  test('shows the empty-state metadata and no date when the memo is blank', () => {
    render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo=""
        source="auto"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName={null}
      />
    )
    expect(
      screen.getByText(
        /No style learned yet — publish your first report and Claude will start here\./i
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Apr 21, 2026/)).toBeNull()
  })

  test('describes an auto-updated memo with the formatted date', () => {
    render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="Write with a confident, concrete voice."
        source="auto"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName={null}
      />
    )
    expect(screen.getByText(/Auto-updated Apr 21, 2026/)).toBeInTheDocument()
  })

  test('describes a manually edited memo with the editor name and formatted date', () => {
    render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="Write with a confident, concrete voice."
        source="manual"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName="Owain Llewellyn"
      />
    )
    expect(screen.getByText(/Edited by Owain Llewellyn on Apr 21, 2026/)).toBeInTheDocument()
  })

  test('saves the edited memo through the server action when Save is clicked', async () => {
    saveStyleMemo.mockResolvedValueOnce({ success: true })
    render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="original memo"
        source="auto"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName={null}
      />
    )

    const textarea = screen.getByTestId('style-memo-textarea')
    fireEvent.change(textarea, { target: { value: 'updated memo' } })

    fireEvent.click(screen.getByTestId('style-memo-save-button'))

    await waitFor(() => {
      expect(saveStyleMemo).toHaveBeenCalledWith(ORG_ID, 'updated memo')
    })
  })

  test('requires dialog confirmation before calling clearStyleMemo', async () => {
    clearStyleMemo.mockResolvedValueOnce({ success: true })
    render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="existing memo"
        source="manual"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName="Owain Llewellyn"
      />
    )

    fireEvent.click(screen.getByTestId('style-memo-clear-button'))
    expect(clearStyleMemo).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByTestId('style-memo-clear-confirm'))

    await waitFor(() => {
      expect(clearStyleMemo).toHaveBeenCalledWith(ORG_ID)
    })
    await waitFor(() => {
      expect(routerRefresh).toHaveBeenCalled()
    })
  })

  test('shows a Regenerated confirmation after a successful regenerate', async () => {
    regenerateStyleMemoFromLatestSnapshot.mockResolvedValueOnce({ success: true })
    render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="original memo"
        source="auto"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName={null}
      />
    )

    fireEvent.click(screen.getByTestId('style-memo-regenerate-button'))

    await waitFor(() => {
      expect(regenerateStyleMemoFromLatestSnapshot).toHaveBeenCalledWith(ORG_ID)
    })
    expect(await screen.findByText('Regenerated')).toBeInTheDocument()
  })

  test('updates the textarea when the memo prop changes and no edits are pending', () => {
    const { rerender } = render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="original memo"
        source="auto"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName={null}
      />
    )

    const textarea = screen.getByTestId('style-memo-textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('original memo')

    rerender(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="fresh regenerated memo"
        source="auto"
        updatedAt="2026-04-22T10:00:00.000Z"
        updatedByName={null}
      />
    )

    expect((screen.getByTestId('style-memo-textarea') as HTMLTextAreaElement).value).toBe(
      'fresh regenerated memo'
    )
  })

  test('preserves unsaved user edits when the memo prop changes', () => {
    const { rerender } = render(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="original memo"
        source="auto"
        updatedAt="2026-04-21T10:00:00.000Z"
        updatedByName={null}
      />
    )

    const textarea = screen.getByTestId('style-memo-textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'user is typing here' } })
    expect(textarea.value).toBe('user is typing here')

    rerender(
      <StyleMemoCard
        orgId={ORG_ID}
        memo="fresh regenerated memo"
        source="auto"
        updatedAt="2026-04-22T10:00:00.000Z"
        updatedByName={null}
      />
    )

    expect((screen.getByTestId('style-memo-textarea') as HTMLTextAreaElement).value).toBe(
      'user is typing here'
    )
  })
})
