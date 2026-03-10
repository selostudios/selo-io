import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type {
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
  LlmsTxtValidation,
} from '../../types'

export const llmsTxt: AuditCheckDefinition = {
  name: 'llms_txt',
  category: CheckCategory.Crawlability,
  priority: CheckPriority.Critical,
  description: 'Check if /llms.txt exists and is properly structured for AI crawlers',
  displayName: 'Missing llms.txt File',
  displayNamePassed: 'llms.txt File',
  learnMoreUrl: 'https://llmstxt.org/',
  isSiteWide: true,
  fixGuidance:
    'Create a /llms.txt file with a title line, description, and a list of page URLs. Follow the specification at llmstxt.org for proper formatting.',
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url).origin
    const llmsTxtUrl = `${baseUrl}/llms.txt`

    try {
      const response = await fetch(llmsTxtUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' },
      })

      if (!response.ok) {
        const validation: LlmsTxtValidation = {
          exists: false,
          url: llmsTxtUrl,
          statusCode: response.status,
          sections: {
            hasTitle: false,
            hasDescription: false,
            hasSitemapRef: false,
            hasPageList: false,
            sectionCount: 0,
          },
          tier: 'missing',
        }

        return {
          status: CheckStatus.Failed,
          details: {
            message:
              'No llms.txt file found. Create a /llms.txt file to help AI assistants understand your site.',
            validation,
          },
        }
      }

      const content = await response.text()
      const validation = validateLlmsTxt(content, llmsTxtUrl, response.status)

      switch (validation.tier) {
        case 'malformed':
          return {
            status: CheckStatus.Failed,
            details: {
              message:
                'llms.txt exists but is malformed. The file should contain valid text with recognizable sections (title, description, page list).',
              validation,
            },
          }
        case 'minimal':
          return {
            status: CheckStatus.Warning,
            details: {
              message:
                'llms.txt exists with some content but is missing key sections. Add a title line, description, and page list with URLs for best results.',
              validation,
            },
          }
        case 'valid':
          return {
            status: CheckStatus.Passed,
            details: {
              message: 'llms.txt is properly structured with title, description, and page list',
              validation,
            },
          }
        default:
          return {
            status: CheckStatus.Failed,
            details: {
              message: 'llms.txt validation returned unexpected result',
              validation,
            },
          }
      }
    } catch {
      const validation: LlmsTxtValidation = {
        exists: false,
        url: llmsTxtUrl,
        statusCode: 0,
        sections: {
          hasTitle: false,
          hasDescription: false,
          hasSitemapRef: false,
          hasPageList: false,
          sectionCount: 0,
        },
        tier: 'missing',
      }

      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Could not access /llms.txt (connection error). Create a /llms.txt file to help AI assistants understand your site.',
          validation,
        },
      }
    }
  },
}

export function validateLlmsTxt(
  content: string,
  url: string,
  statusCode: number
): LlmsTxtValidation {
  const trimmed = content.trim()

  // Check if content is valid text (not HTML, JSON, binary, etc.)
  const isLikelyBinary = /[\x00-\x08\x0E-\x1F]/.test(trimmed)
  const isHtml = /^\s*<!DOCTYPE|^\s*<html/i.test(trimmed)
  const isJson = /^\s*[{[]/.test(trimmed)

  if (!trimmed || isLikelyBinary || isHtml || isJson) {
    return {
      exists: true,
      url,
      statusCode,
      content: trimmed.slice(0, 500),
      sections: {
        hasTitle: false,
        hasDescription: false,
        hasSitemapRef: false,
        hasPageList: false,
        sectionCount: 0,
      },
      tier: 'malformed',
    }
  }

  const lines = trimmed.split('\n').map((l) => l.trim())
  const nonEmptyLines = lines.filter((l) => l.length > 0)

  // llms.txt spec: first line is title (starts with # ), followed by description block,
  // then sections with ## headings and URL lists
  const hasTitle = nonEmptyLines.length > 0 && /^#\s+.+/.test(nonEmptyLines[0])

  // Description: text content after title, before first ## section
  const firstSectionIndex = lines.findIndex((l) => /^##\s+/.test(l))
  const descriptionLines =
    firstSectionIndex > 0
      ? lines.slice(1, firstSectionIndex).filter((l) => l.length > 0 && !l.startsWith('#'))
      : hasTitle
        ? lines.slice(1).filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('-'))
        : []
  const hasDescription = descriptionLines.some((l) => l.length > 10)

  // Check for sitemap reference
  const hasSitemapRef = /sitemap/i.test(trimmed)

  // Check for page list (URLs in the content)
  const urlPattern = /https?:\/\/[^\s)]+/g
  const urls = trimmed.match(urlPattern) || []
  const hasPageList = urls.length >= 1

  // Count sections (## headings)
  const sectionCount = lines.filter((l) => /^##\s+/.test(l)).length

  const sections = {
    hasTitle,
    hasDescription,
    hasSitemapRef,
    hasPageList,
    sectionCount,
  }

  // Determine tier
  let tier: LlmsTxtValidation['tier']
  if (hasTitle && hasDescription && hasPageList) {
    tier = 'valid'
  } else if (nonEmptyLines.length >= 2 && (hasTitle || hasDescription || hasPageList)) {
    tier = 'minimal'
  } else {
    tier = 'malformed'
  }

  return {
    exists: true,
    url,
    statusCode,
    content: trimmed.slice(0, 500),
    sections,
    tier,
  }
}
