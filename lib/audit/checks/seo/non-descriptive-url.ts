import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

// Common stop words to ignore when comparing
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'what',
  'which',
  'who',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'also',
])

// Patterns that indicate non-descriptive URLs
const ID_PATTERNS = [
  /^[0-9]+$/, // Pure numbers
  /^[a-f0-9]{8,}$/i, // Hex strings (UUIDs, hashes)
  /^[a-z0-9]{20,}$/i, // Long alphanumeric strings
  /^\d{4}-\d{2}-\d{2}$/, // Date patterns
]

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

function isLikelyId(segment: string): boolean {
  return ID_PATTERNS.some((pattern) => pattern.test(segment))
}

function getUrlSegments(url: string): string[] {
  try {
    const parsed = new URL(url)
    return parsed.pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.replace(/\.[^.]+$/, '')) // Remove file extensions
  } catch {
    return []
  }
}

export const nonDescriptiveUrl: AuditCheckDefinition = {
  name: 'non_descriptive_url',
  type: 'seo',
  priority: 'recommended',
  description: 'URL slugs should be descriptive and relate to page content',
  displayName: 'Non-Descriptive URL',
  displayNamePassed: 'Descriptive URL',
  learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/url-structure',

  async run(context: CheckContext): Promise<CheckResult> {
    const segments = getUrlSegments(context.url)

    // Skip homepage - it has no slug to check
    if (segments.length === 0) {
      return {
        status: 'passed',
        details: { message: 'Homepage - no URL slug to check' },
      }
    }

    const issues: string[] = []
    const slug = segments[segments.length - 1] // Last segment is the main slug

    // Check 1: Is the slug just an ID or random string?
    if (isLikelyId(slug)) {
      return {
        status: 'failed',
        details: {
          message: `URL contains ID-like slug "${slug}" instead of descriptive words. Use keyword-rich URLs like /services/web-design instead of /page/12345`,
          slug,
        },
      }
    }

    // Check 2: Does slug contain any meaningful words?
    const slugWords = extractWords(slug.replace(/-/g, ' '))
    if (slugWords.length === 0 && slug.length > 0) {
      issues.push(`Slug "${slug}" contains no meaningful keywords`)
    }

    // Check 3: Check for underscores (should use hyphens)
    if (slug.includes('_')) {
      issues.push(
        'URL uses underscores instead of hyphens. Search engines prefer hyphens as word separators'
      )
    }

    // Check 4: Check for uppercase (should be lowercase)
    if (slug !== slug.toLowerCase()) {
      issues.push('URL contains uppercase characters. Use lowercase for consistency')
    }

    // Check 5: Check URL length (full path)
    const fullPath = '/' + segments.join('/')
    if (fullPath.length > 75) {
      issues.push(
        `URL path is ${fullPath.length} characters. Consider shortening for better usability`
      )
    }

    // Check 6: Compare slug words with title words
    if (context.title && slugWords.length > 0) {
      const titleWords = extractWords(context.title)
      const overlap = slugWords.filter((word) => titleWords.includes(word))

      // If slug has words but none match the title, it might not be descriptive
      if (overlap.length === 0 && titleWords.length > 0 && slugWords.length >= 2) {
        issues.push(
          `URL slug words don't appear in page title. Consider aligning URL with page content for better SEO`
        )
      }
    }

    if (issues.length > 0) {
      return {
        status: 'warning',
        details: {
          message: issues.join('. '),
          slug,
          path: fullPath,
        },
      }
    }

    return {
      status: 'passed',
      details: {
        message: `URL "${slug}" is descriptive and well-formatted`,
      },
    }
  },
}
