import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const sslCertificate: AIOCheckDefinition = {
  name: 'ssl_certificate',
  category: 'technical_foundation',
  priority: 'critical',
  description: 'HTTPS is required for AI crawlers to trust and index your content',
  displayName: 'Missing HTTPS',
  displayNamePassed: 'HTTPS Enabled',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/https',
  isSiteWide: true,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const url = new URL(context.url)

    if (url.protocol !== 'https:') {
      return {
        status: 'failed',
        details: {
          message: 'Site is not using HTTPS. AI engines require secure connections for content indexing.',
          protocol: url.protocol,
          fixGuidance: 'Enable HTTPS with a valid SSL certificate. Most hosting providers offer free certificates via Let\'s Encrypt.',
        },
      }
    }

    return {
      status: 'passed',
      details: {
        message: 'Site uses HTTPS with valid SSL certificate',
        protocol: url.protocol,
      },
    }
  },
}
