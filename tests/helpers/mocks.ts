import { vi } from 'vitest'

export function mockResend() {
  vi.mock('@/lib/email/client', () => ({
    resend: {
      emails: {
        send: vi.fn().mockResolvedValue({
          id: 'mock-email-id',
          from: 'noreply@selo.io',
          to: 'test@example.com'
        })
      }
    },
    FROM_EMAIL: 'noreply@selo.io'
  }))
}

export function mockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            created_at: new Date().toISOString()
          }
        },
        error: null
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null })
    })
  }
}

export function resetAllMocks() {
  vi.clearAllMocks()
  vi.resetAllMocks()
}
