import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY environment variable is required')
  }
  // Use scrypt to derive a proper key from the secret
  return scryptSync(secret, 'selo-credentials-salt', KEY_LENGTH)
}

export function encryptCredentials(data: Record<string, unknown>): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const salt = randomBytes(SALT_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const jsonData = JSON.stringify(data)

  let encrypted = cipher.update(jsonData, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Combine salt + iv + authTag + encrypted data
  const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')])

  return combined.toString('base64')
}

export function decryptCredentials<T = Record<string, unknown>>(encryptedData: string): T {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

  // Salt is stored but not used in decryption (used for key derivation consistency)
  void salt

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted) as T
}

export function isEncrypted(data: unknown): boolean {
  // Check if data is a base64 string (encrypted) or an object (plain JSON)
  if (typeof data === 'string') {
    try {
      // Try to decode as base64 and check minimum length
      const decoded = Buffer.from(data, 'base64')
      return decoded.length >= SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    } catch {
      return false
    }
  }
  return false
}
