// lib/audit/fetcher.ts
import * as cheerio from 'cheerio'

export interface FetchResult {
  html: string
  statusCode: number
  lastModified: string | null
  error?: string
}

export async function fetchPage(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SeloBot/1.0 (Site Audit)',
      },
      redirect: 'follow',
    })

    const html = await response.text()
    const lastModifiedHeader = response.headers.get('last-modified')
    let lastModified: string | null = null
    if (lastModifiedHeader) {
      try {
        const date = new Date(lastModifiedHeader)
        if (!isNaN(date.getTime())) {
          lastModified = date.toISOString()
        }
      } catch {
        // Invalid date format, ignore
      }
    }

    return {
      html,
      statusCode: response.status,
      lastModified,
    }
  } catch (error) {
    return {
      html: '',
      statusCode: 0,
      lastModified: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const links = new Set<string>()

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')
    if (!href) return

    try {
      const url = new URL(href, baseUrl)

      // Only include internal links (same hostname)
      if (url.hostname === base.hostname) {
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
