import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptCredentials, decryptCredentials, isEncrypted } from '@/lib/utils/crypto'

describe('crypto', () => {
  const originalEnv = process.env.CREDENTIALS_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests'
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CREDENTIALS_ENCRYPTION_KEY = originalEnv
    } else {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
    }
  })

  describe('encrypt/decrypt round-trip', () => {
    it('round-trips simple credentials', () => {
      const data = { access_token: 'abc123', refresh_token: 'xyz789' }
      const encrypted = encryptCredentials(data)
      const decrypted = decryptCredentials(encrypted)
      expect(decrypted).toEqual(data)
    })

    it('round-trips nested objects', () => {
      const data = { tokens: { access: 'a', refresh: 'b' }, meta: { org: '123' } }
      const encrypted = encryptCredentials(data)
      const decrypted = decryptCredentials(encrypted)
      expect(decrypted).toEqual(data)
    })

    it('round-trips special characters', () => {
      const data = { key: 'value with spaces & symbols! "quotes" <html>' }
      const encrypted = encryptCredentials(data)
      const decrypted = decryptCredentials(encrypted)
      expect(decrypted).toEqual(data)
    })

    it('produces different ciphertext each time due to random IV', () => {
      const data = { token: 'same' }
      const enc1 = encryptCredentials(data)
      const enc2 = encryptCredentials(data)
      expect(enc1).not.toBe(enc2)
    })
  })

  describe('isEncrypted', () => {
    it('returns true for encrypted string', () => {
      const encrypted = encryptCredentials({ token: 'test' })
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('returns false for plain JSON string', () => {
      expect(isEncrypted('{"token": "test"}')).toBe(false)
    })

    it('returns false for short base64 string', () => {
      // Less than SALT_LENGTH + IV_LENGTH + TAG_LENGTH = 64 bytes
      expect(isEncrypted(Buffer.from('short').toString('base64'))).toBe(false)
    })

    it('returns false for non-string values', () => {
      expect(isEncrypted({ token: 'test' })).toBe(false)
      expect(isEncrypted(123)).toBe(false)
      expect(isEncrypted(null)).toBe(false)
    })
  })

  describe('missing encryption key', () => {
    it('throws when CREDENTIALS_ENCRYPTION_KEY is not set', () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
      expect(() => encryptCredentials({ token: 'test' })).toThrow(
        'CREDENTIALS_ENCRYPTION_KEY environment variable is required'
      )
    })
  })
})
