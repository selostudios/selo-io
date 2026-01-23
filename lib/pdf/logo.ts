import * as path from 'path'
import * as fs from 'fs'

/**
 * Get the Selo logo as a base64 data URI for use in PDFs.
 * Returns empty string if logo file is not found.
 */
export function getLogoDataUri(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'selo-logo.jpg.webp')
    const logoBuffer = fs.readFileSync(logoPath)
    return `data:image/webp;base64,${logoBuffer.toString('base64')}`
  } catch {
    return ''
  }
}
