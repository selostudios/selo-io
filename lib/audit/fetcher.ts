// lib/audit/fetcher.ts
import * as cheerio from 'cheerio'
import https from 'https'
import http from 'http'

export interface FetchResult {
  html: string
  statusCode: number
  lastModified: string | null
  finalUrl?: string
  error?: string
}

/**
 * Fetch a page with SSL error recovery.
 * First tries normal fetch, then falls back to relaxed SSL if certificate errors occur.
 */
export async function fetchPage(url: string): Promise<FetchResult> {
  // Try normal fetch first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SeloBot/1.0 (Site Audit)',
      },
      redirect: 'follow',
    })

    const html = await response.text()
    const lastModified = parseLastModified(response.headers.get('last-modified'))

    return {
      html,
      statusCode: response.status,
      lastModified,
      finalUrl: response.url,
    }
  } catch (error) {
    // Check if it's an SSL certificate error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const cause = (error as { cause?: Error })?.cause
    const isSSLError =
      errorMessage.includes('certificate') ||
      errorMessage.includes('SSL') ||
      errorMessage.includes('TLS') ||
      cause?.message?.includes('certificate') ||
      (cause as { code?: string })?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'

    if (isSSLError) {
      console.log(`[Audit Fetcher] SSL error for ${url}, retrying with relaxed verification`)
      return fetchWithRelaxedSSL(url)
    }

    return {
      html: '',
      statusCode: 0,
      lastModified: null,
      error: errorMessage,
    }
  }
}

/**
 * Fetch with relaxed SSL verification for sites with certificate issues.
 * Uses Node.js http/https modules directly.
 */
function fetchWithRelaxedSSL(url: string): Promise<FetchResult> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === 'https:'
    const lib = isHttps ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'SeloBot/1.0 (Site Audit)',
      },
      rejectUnauthorized: false, // Allow self-signed/invalid certificates
    }

    const req = lib.request(options, (res) => {
      // Handle redirects manually
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href
        // Recursively follow redirect with relaxed SSL
        resolve(fetchWithRelaxedSSL(redirectUrl))
        return
      }

      let html = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        html += chunk
      })
      res.on('end', () => {
        const lastModified = parseLastModified(res.headers['last-modified'] as string | undefined)
        resolve({
          html,
          statusCode: res.statusCode || 0,
          lastModified,
          finalUrl: url,
        })
      })
    })

    req.on('error', (error) => {
      resolve({
        html: '',
        statusCode: 0,
        lastModified: null,
        error: error.message,
      })
    })

    req.setTimeout(30000, () => {
      req.destroy()
      resolve({
        html: '',
        statusCode: 0,
        lastModified: null,
        error: 'Request timeout',
      })
    })

    req.end()
  })
}

function parseLastModified(header: string | null | undefined): string | null {
  if (!header) return null
  try {
    const date = new Date(header)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  } catch {
    // Invalid date format, ignore
  }
  return null
}

/**
 * Extract internal links from HTML.
 * @param html - The HTML content to parse
 * @param baseUrl - The original URL (used as base for relative links)
 * @param finalUrl - The final URL after redirects (used for hostname matching)
 */
export function extractLinks(html: string, baseUrl: string, finalUrl?: string): string[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const final = finalUrl ? new URL(finalUrl) : base

  // Build list of valid hostnames (handles www vs non-www redirects)
  const validHostnames = new Set<string>([
    base.hostname,
    final.hostname,
    // Also accept www/non-www variants
    base.hostname.startsWith('www.') ? base.hostname.slice(4) : `www.${base.hostname}`,
    final.hostname.startsWith('www.') ? final.hostname.slice(4) : `www.${final.hostname}`,
  ])

  const links = new Set<string>()

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (!href) return

    try {
      // Use final URL as base for resolving relative links
      const url = new URL(href, finalUrl || baseUrl)

      // Only include internal links (matching any valid hostname)
      if (validHostnames.has(url.hostname)) {
        // Normalize: remove hash, trailing slash
        url.hash = ''
        const normalized = url.href.replace(/\/$/, '')
        links.add(normalized)
      }
    } catch {
      // Invalid URL, skip
    }
  })

  return Array.from(links)
}
