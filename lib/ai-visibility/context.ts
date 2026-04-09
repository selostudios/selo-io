import type { OrgContext } from './analyzer'

interface OrgContextInput {
  orgName: string
  websiteUrl: string | null
  competitors: { name: string; domain: string }[]
}

function parseDomain(websiteUrl: string | null): string {
  if (!websiteUrl) return ''
  try {
    const hostname = new URL(websiteUrl).hostname.toLowerCase()
    return hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Build OrgContext for the analyzer from organization and config data.
 */
export function buildOrgContext(input: OrgContextInput): OrgContext {
  const competitorNames = input.competitors.map((c) => c.name)
  const competitorDomains: Record<string, string> = {}
  for (const c of input.competitors) {
    competitorDomains[c.name] = c.domain
  }

  return {
    brandName: input.orgName,
    domain: parseDomain(input.websiteUrl),
    competitors: competitorNames,
    competitorDomains,
  }
}
