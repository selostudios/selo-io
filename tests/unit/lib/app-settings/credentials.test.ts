import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Mock crypto
vi.mock('@/lib/utils/crypto', () => ({
  decryptCredentials: vi.fn(),
}))

import { getAppCredential, maskCredential, ENV_VAR_MAP } from '@/lib/app-settings/credentials'
import { createServiceClient } from '@/lib/supabase/server'
import { decryptCredentials } from '@/lib/utils/crypto'

describe('getAppCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns decrypted value from app_settings when row exists', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: { encrypted: 'encrypted-data' }, error: null }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any)
    vi.mocked(decryptCredentials).mockReturnValue({ api_key: 'sk-ant-real-key' })

    const result = await getAppCredential('anthropic')
    expect(result).toBe('sk-ant-real-key')
  })

  it('falls back to env var when no app_settings row exists', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any)
    process.env.ANTHROPIC_API_KEY = 'env-key'

    const result = await getAppCredential('anthropic')
    expect(result).toBe('env-key')

    delete process.env.ANTHROPIC_API_KEY
  })

  it('returns null when neither app_settings nor env var exists', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any)
    delete process.env.ANTHROPIC_API_KEY

    const result = await getAppCredential('anthropic')
    expect(result).toBeNull()
  })

  it('maps correct env vars for each key', () => {
    expect(ENV_VAR_MAP.anthropic).toBe('ANTHROPIC_API_KEY')
    expect(ENV_VAR_MAP.resend).toBe('RESEND_API_KEY')
    expect(ENV_VAR_MAP.pagespeed).toBe('PAGESPEED_API_KEY')
    expect(ENV_VAR_MAP.cron_secret).toBe('CRON_SECRET')
  })
})

describe('maskCredential', () => {
  it('masks a long credential showing last 6 chars', () => {
    const result = maskCredential('sk-ant-abc123xyz789')
    expect(result).toBe('•••••••••••••xyz789')
  })

  it('returns null for empty string', () => {
    expect(maskCredential('')).toBeNull()
  })

  it('returns null for string shorter than 6 chars', () => {
    expect(maskCredential('abc')).toBeNull()
  })

  it('handles exactly 6 char string (no masking dots)', () => {
    expect(maskCredential('abc123')).toBe('abc123')
  })

  it('caps dots at 20 for very long credentials', () => {
    const longKey = 'a'.repeat(30) + 'xyz789'
    const result = maskCredential(longKey)
    expect(result).toBe('••••••••••••••••••••xyz789')
  })
})
