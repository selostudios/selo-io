/**
 * File upload validation using magic bytes (file signatures).
 *
 * Validates actual file content rather than trusting the client-reported
 * MIME type or file extension, which can be trivially spoofed.
 */

// Known file signatures (magic bytes)
const SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/jpeg': [
    { bytes: [0xff, 0xd8, 0xff, 0xe0] },
    { bytes: [0xff, 0xd8, 0xff, 0xe1] },
    { bytes: [0xff, 0xd8, 0xff, 0xe2] },
    { bytes: [0xff, 0xd8, 0xff, 0xdb] },
    { bytes: [0xff, 0xd8, 0xff, 0xee] },
  ],
  'image/webp': [
    // RIFF....WEBP — check RIFF at 0 and WEBP at 8
    { bytes: [0x52, 0x49, 0x46, 0x46] },
  ],
}

/** Map of detected MIME type to canonical file extension. */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface FileValidationResult {
  valid: boolean
  mime?: string
  extension?: string
}

/**
 * Detect the real MIME type of a file by inspecting its magic bytes.
 * Returns the detected MIME type and extension, or `{ valid: false }` if
 * the file doesn't match any allowed type.
 *
 * @param allowedTypes Array of MIME types to accept (e.g. ['image/png', 'image/jpeg'])
 */
export async function validateFileSignature(
  file: File,
  allowedTypes: string[]
): Promise<FileValidationResult> {
  const buffer = new Uint8Array(await file.slice(0, 16).arrayBuffer())

  for (const mime of allowedTypes) {
    const signatures = SIGNATURES[mime]
    if (!signatures) continue

    for (const sig of signatures) {
      const offset = sig.offset ?? 0
      const matches = sig.bytes.every((byte, i) => buffer[offset + i] === byte)

      if (matches) {
        // Extra check for WebP: bytes 8-11 must be "WEBP"
        if (mime === 'image/webp') {
          const webpTag =
            buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
          if (!webpTag) continue
        }

        return { valid: true, mime, extension: MIME_TO_EXT[mime] }
      }
    }
  }

  return { valid: false }
}
