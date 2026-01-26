import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const redirectChains: AuditCheckDefinition = {
  name: 'redirect_chains',
  type: 'seo',
  priority: 'recommended',
  description:
    'Redirect chains waste crawl budget and dilute PageRank. Redirects should go directly to the final URL.',
  displayName: 'Redirect Chains Detected',
  displayNamePassed: 'No Redirect Chains',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/301-redirects#redirect-chains',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    // Find pages that returned 3xx status codes
    const redirectPages = context.allPages.filter((page) => {
      const status = page.status_code ?? 200
      return status >= 300 && status < 400
    })

    if (redirectPages.length === 0) {
      return {
        status: 'passed',
        details: {
          message: 'No redirects found in crawled pages',
        },
      }
    }

    // For each redirect, follow the chain to detect multi-hop redirects
    const chains: Array<{
      url: string
      chain: string[]
      hops: number
    }> = []

    const followRedirectChain = async (
      startUrl: string,
      maxHops = 10
    ): Promise<{ chain: string[]; finalUrl: string }> => {
      const chain: string[] = [startUrl]
      let currentUrl = startUrl

      for (let i = 0; i < maxHops; i++) {
        try {
          const response = await fetch(currentUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
            redirect: 'manual', // Don't follow redirects automatically
          })

          const status = response.status

          if (status >= 300 && status < 400) {
            const location = response.headers.get('location')
            if (!location) break

            // Resolve relative URLs
            const nextUrl = new URL(location, currentUrl).href
            chain.push(nextUrl)
            currentUrl = nextUrl

            // Detect redirect loops
            if (chain.slice(0, -1).includes(nextUrl)) {
              break
            }
          } else {
            // Reached final destination
            break
          }
        } catch {
          // Error following redirect
          break
        }
      }

      return { chain, finalUrl: currentUrl }
    }

    // Check a sample of redirect pages (limit to avoid long audit times)
    const samplesToCheck = redirectPages.slice(0, 20)

    for (const page of samplesToCheck) {
      try {
        const { chain } = await followRedirectChain(page.url)

        // If chain has more than 2 URLs (start + end), there's a chain
        if (chain.length > 2) {
          chains.push({
            url: page.url,
            chain,
            hops: chain.length - 1,
          })
        }
      } catch {
        // Skip pages that error
        continue
      }
    }

    if (chains.length === 0) {
      return {
        status: 'passed',
        details: {
          message: `Checked ${samplesToCheck.length} redirect${samplesToCheck.length > 1 ? 's' : ''}, no chains detected`,
          redirectsChecked: samplesToCheck.length,
        },
      }
    }

    // Sort by longest chains first
    chains.sort((a, b) => b.hops - a.hops)

    const maxHops = chains[0].hops
    const summary = chains
      .slice(0, 3)
      .map((c) => `${c.url} (${c.hops} hops)`)
      .join(', ')

    return {
      status: maxHops >= 3 ? 'failed' : 'warning',
      details: {
        message: `Found ${chains.length} redirect chain${chains.length > 1 ? 's' : ''} with up to ${maxHops} hops. Examples: ${summary}. Update internal links to point directly to the final URL.`,
        chainCount: chains.length,
        maxHops,
        longestChains: chains.slice(0, 5).map((c) => ({
          startUrl: c.url,
          hops: c.hops,
          chain: c.chain,
        })),
      },
    }
  },
}
