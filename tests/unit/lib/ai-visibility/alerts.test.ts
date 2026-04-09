import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
}))

import { sendBudgetAlert } from '@/lib/ai-visibility/alerts'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/client'

describe('sendBudgetAlert', () => {
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockEq = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Chain: from('users').select(...).eq('is_internal', true)
    mockEq.mockResolvedValue({
      data: [{ email: 'alice@selo.co' }, { email: 'bob@selo.co' }],
      error: null,
    })
    mockSelect.mockReturnValue({ eq: mockEq })

    // Chain: from('ai_visibility_configs').update(...).eq('organization_id', ...)
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'users') return { select: mockSelect }
        if (table === 'ai_visibility_configs') return { update: mockUpdate }
        return {}
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  it('sends emails to all internal users', async () => {
    await sendBudgetAlert({
      organizationId: 'org-1',
      orgName: 'Warby Parker',
      alertType: 'approaching',
      currentSpendCents: 9000,
      budgetCents: 10000,
      thresholdPercent: 90,
    })

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@selo.co',
        subject: expect.stringContaining('Warby Parker'),
      })
    )
  })

  it('updates config with alert type and timestamp', async () => {
    await sendBudgetAlert({
      organizationId: 'org-1',
      orgName: 'Warby Parker',
      alertType: 'exceeded',
      currentSpendCents: 11000,
      budgetCents: 10000,
      thresholdPercent: 90,
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        last_alert_type: 'exceeded',
      })
    )
  })

  it('does not throw if email sending fails', async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      data: null,
      error: { message: 'Failed' },
    })

    await expect(
      sendBudgetAlert({
        organizationId: 'org-1',
        orgName: 'Test',
        alertType: 'approaching',
        currentSpendCents: 9000,
        budgetCents: 10000,
        thresholdPercent: 90,
      })
    ).resolves.not.toThrow()
  })
})
