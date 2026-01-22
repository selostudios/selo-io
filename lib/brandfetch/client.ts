import type { BrandfetchResponse, BrandData } from './types'

const BRANDFETCH_API_URL = 'https://api.brandfetch.io/v2/brands'

export class BrandfetchError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = 'BrandfetchError'
  }
}

/**
 * Extract domain from a URL
 * e.g., "https://www.example.com/about" -> "example.com"
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove www. prefix if present
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    throw new Error('Invalid URL format')
  }
}

/**
 * Fetch brand data from Brandfetch API
 */
export async function fetchBrandfetch(domain: string): Promise<BrandfetchResponse> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) {
    throw new Error('BRANDFETCH_API_KEY is not configured')
  }

  const response = await fetch(`${BRANDFETCH_API_URL}/${domain}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new BrandfetchError('No brand data found for this domain', 404)
    }
    if (response.status === 429) {
      throw new BrandfetchError('Too many requests. Please wait a moment.', 429)
    }
    throw new BrandfetchError('Failed to fetch brand data', response.status)
  }

  return response.json()
}

/**
 * Select the best logo from Brandfetch response
 * Preference: light theme > any theme, logo type > icon > symbol
 * Format preference: SVG > PNG > JPG
 */
function selectBestLogo(logos: BrandfetchResponse['logos']): BrandData['logo'] {
  if (!logos || logos.length === 0) return null

  // Sort by preference
  const sorted = [...logos].sort((a, b) => {
    // Prefer light theme
    const themeScore = (logo: typeof a) => (logo.theme === 'light' ? 2 : logo.theme === null ? 1 : 0)
    // Prefer logo type
    const typeScore = (logo: typeof a) => {
      if (logo.type === 'logo') return 3
      if (logo.type === 'icon') return 2
      if (logo.type === 'symbol') return 1
      return 0
    }
    return themeScore(b) + typeScore(b) - (themeScore(a) + typeScore(a))
  })

  const best = sorted[0]
  if (!best.formats || best.formats.length === 0) return null

  // Sort formats by preference: SVG > PNG > others
  const sortedFormats = [...best.formats].sort((a, b) => {
    const formatScore = (f: typeof a) => {
      if (f.format === 'svg') return 3
      if (f.format === 'png') return 2
      return 1
    }
    return formatScore(b) - formatScore(a)
  })

  return {
    url: sortedFormats[0].src,
    format: sortedFormats[0].format,
  }
}

/**
 * Extract colors from Brandfetch response
 * Maps to our primary/secondary/accent structure
 */
function extractColors(colors: BrandfetchResponse['colors']): BrandData['colors'] {
  if (!colors || colors.length === 0) {
    return { primary: null, secondary: null, accent: null }
  }

  // Find colors by type
  const brandColor = colors.find((c) => c.type === 'brand')
  const accentColor = colors.find((c) => c.type === 'accent')
  const lightColor = colors.find((c) => c.type === 'light')
  const darkColor = colors.find((c) => c.type === 'dark')

  return {
    primary: brandColor?.hex || darkColor?.hex || colors[0]?.hex || null,
    secondary: lightColor?.hex || null,
    accent: accentColor?.hex || null,
  }
}

/**
 * Normalize Brandfetch response to our app's data structure
 */
export function normalizeBrandData(response: BrandfetchResponse): BrandData {
  return {
    name: response.name,
    description: response.description,
    logo: selectBestLogo(response.logos),
    colors: extractColors(response.colors),
    socialLinks: (response.links || []).map((link) => ({
      platform: link.name,
      url: link.url,
    })),
    location: {
      city: response.company?.location?.city || null,
      country: response.company?.location?.country || null,
    },
    raw: response,
  }
}
