import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import {
  triggerAuditContinuation,
  type ContinuationFailureInfo,
} from '@/lib/unified-audit/trigger-continuation'

type NotifyFn = (info: ContinuationFailureInfo) => void | Promise<void>

describe('triggerAuditContinuation', () => {
  const OLD_ENV = process.env
  let fetchMock: Mock
  let notifyMock: Mock & NotifyFn

  beforeEach(() => {
    vi.useFakeTimers()
    process.env = {
      ...OLD_ENV,
      NEXT_PUBLIC_SITE_URL: 'https://app.example.com',
      CRON_SECRET: 'test-secret',
    }
    fetchMock = vi.fn()
    notifyMock = vi.fn().mockResolvedValue(undefined) as Mock & NotifyFn
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    process.env = OLD_ENV
  })

  it('POSTs to the correct unified-audit continue URL with CRON_SECRET on success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.example.com/api/unified-audit/audit-123/continue',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-cron-secret': 'test-secret' }),
      })
    )
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('POSTs to the legacy audit path when kind is legacy', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    await triggerAuditContinuation({
      auditId: 'audit-456',
      kind: 'legacy',
      notifyOnFailure: notifyMock,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.example.com/api/audit/audit-456/continue',
      expect.any(Object)
    )
  })

  it('treats HTTP 409 as a successful handoff (audit already claimed)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }))

    const result = await triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(1)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('retries on transient failure with exponential backoff and succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const promise = triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })

    // First attempt runs immediately, then two retries with backoff
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(3)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('retries on 5xx responses', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const promise = triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(2)
  })

  it('does NOT retry on HTTP 508 (Vercel loop detection is permanent)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 508 }))

    const promise = triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledTimes(1)
  })

  it('passes chainDepth as x-chain-depth header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    await triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      chainDepth: 7,
      notifyOnFailure: notifyMock,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-chain-depth': '7' }),
      })
    )
  })

  it('does NOT retry on 4xx (except 408 and 429)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

    const promise = triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after all retries exhausted and calls notifyOnFailure', async () => {
    fetchMock.mockRejectedValue(new Error('always fails'))

    const promise = triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(3)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 'audit-123',
        reason: expect.stringContaining('always fails'),
      })
    )
  })

  it('returns failure without network call when no base URL is configured', async () => {
    process.env = { ...OLD_ENV, NEXT_PUBLIC_SITE_URL: '', VERCEL_URL: '', CRON_SECRET: 'x' }

    const result = await triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(notifyMock).toHaveBeenCalledTimes(1)
  })

  it('respects per-attempt timeout via AbortSignal', async () => {
    // If a fetch never resolves within the timeout, AbortController should abort it
    // and trigger a retry. We simulate by having fetch reject with an AbortError.
    fetchMock
      .mockImplementationOnce(() => Promise.reject(new DOMException('aborted', 'AbortError')))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const promise = triggerAuditContinuation({
      auditId: 'audit-123',
      kind: 'unified',
      notifyOnFailure: notifyMock,
    })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.attempts).toBe(2)
  })
})
