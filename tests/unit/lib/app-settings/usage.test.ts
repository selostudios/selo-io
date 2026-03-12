import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { logUsage } from '@/lib/app-settings/usage'
import { createServiceClient } from '@/lib/supabase/server'

describe('logUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a usage log record via service client', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    vi.mocked(createServiceClient).mockReturnValue({ from: mockFrom } as any)

    await logUsage('anthropic', 'ai_analysis', {
      organizationId: 'org-123',
      tokensInput: 1000,
      tokensOutput: 500,
      cost: 0.0045,
      metadata: { model: 'claude-sonnet-4-5-20250514' },
    })

    expect(mockFrom).toHaveBeenCalledWith('usage_logs')
    expect(mockInsert).toHaveBeenCalledWith({
      service: 'anthropic',
      event_type: 'ai_analysis',
      organization_id: 'org-123',
      tokens_input: 1000,
      tokens_output: 500,
      cost: 0.0045,
      metadata: { model: 'claude-sonnet-4-5-20250514' },
    })
  })

  it('does not throw on insert failure (fire-and-forget)', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: { message: 'DB down' } })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    vi.mocked(createServiceClient).mockReturnValue({ from: mockFrom } as any)

    // Should not throw
    await logUsage('resend', 'email_sent', {})
  })

  it('does not throw on unexpected error', async () => {
    vi.mocked(createServiceClient).mockImplementation(() => {
      throw new Error('Connection refused')
    })

    // Should not throw
    await logUsage('anthropic', 'ai_analysis', {})
  })

  it('uses null defaults when options are omitted', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    vi.mocked(createServiceClient).mockReturnValue({ from: mockFrom } as any)

    await logUsage('pagespeed', 'psi_fetch')

    expect(mockInsert).toHaveBeenCalledWith({
      service: 'pagespeed',
      event_type: 'psi_fetch',
      organization_id: null,
      tokens_input: null,
      tokens_output: null,
      cost: null,
      metadata: null,
    })
  })
})
