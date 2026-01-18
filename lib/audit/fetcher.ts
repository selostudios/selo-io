// lib/audit/fetcher.ts
import * as cheerio from 'cheerio'

export interface FetchResult {
  html: string
  statusCode: number
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

    return {
      html,
      statusCode: response.status,
    }
  } catch (error) {
    return {
      html: '',
      statusCode: 0,
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
