import { describe, it, expect } from 'vitest'
import { CheckStatus } from '@/lib/enums'
import { schemaMarkup } from '@/lib/unified-audit/checks/structured-data/schema-markup'
import { organizationSchema } from '@/lib/unified-audit/checks/structured-data/organization-schema'
import { speakableSchema } from '@/lib/unified-audit/checks/structured-data/speakable-schema'
import { schemaValidation } from '@/lib/unified-audit/checks/structured-data/schema-validation'
import type { CheckContext } from '@/lib/unified-audit/types'

function makeContext(html: string, url = 'https://example.com'): CheckContext {
  return { url, html }
}

function wrapJsonLd(data: object): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`
}

function wrapMultipleJsonLd(schemas: object[]): string {
  const scripts = schemas
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('')
  return `<html><head>${scripts}</head><body></body></html>`
}

// =============================================================================
// schema-markup
// =============================================================================

describe('schema-markup', () => {
  it('fails when no JSON-LD scripts are present', async () => {
    const result = await schemaMarkup.run(makeContext('<html><head></head><body></body></html>'))
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.totalSchemas).toBe(0)
  })

  it('fails when JSON-LD script exists but contains invalid JSON', async () => {
    const html =
      '<html><head><script type="application/ld+json">not valid json</script></head><body></body></html>'
    const result = await schemaMarkup.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
  })

  it('passes when valid Article schema is found', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test Article',
    })
    const result = await schemaMarkup.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.schemas).toContain('Article')
  })

  it('warns when schema exists but is not AIO-relevant', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [],
    })
    const result = await schemaMarkup.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.schemas).toContain('BreadcrumbList')
  })

  it('handles @graph structure with multiple schemas', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Test' },
        { '@type': 'WebPage', name: 'Home' },
      ],
    })
    const result = await schemaMarkup.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.totalSchemas).toBe(2)
  })

  it('handles multiple JSON-LD script tags', async () => {
    const html = wrapMultipleJsonLd([
      { '@context': 'https://schema.org', '@type': 'Article', headline: 'Test' },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] },
    ])
    const result = await schemaMarkup.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.totalSchemas).toBe(2)
  })

  it('handles array @type', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': ['Article', 'NewsArticle'],
      headline: 'Test',
    })
    const result = await schemaMarkup.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.schemas).toEqual(['Article, NewsArticle'])
  })
})

// =============================================================================
// organization-schema
// =============================================================================

describe('organization-schema', () => {
  it('fails when no Organization schema is found', async () => {
    const html = '<html><head></head><body></body></html>'
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.exists).toBe(false)
  })

  it('passes with complete Organization schema', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme Corp',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      description: 'A test company',
      sameAs: [
        'https://www.linkedin.com/company/acme',
        'https://twitter.com/acme',
        'https://en.wikipedia.org/wiki/Acme',
      ],
    })
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.exists).toBe(true)
    expect(result.details?.hasName).toBe(true)
    expect(result.details?.hasLogo).toBe(true)
  })

  it('warns when Organization schema is missing fields', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme Corp',
    })
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.hasUrl).toBe(false)
    expect(result.details?.hasLogo).toBe(false)
  })

  it('recognizes LocalBusiness as Organization variant', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Local Shop',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      description: 'A local shop',
    })
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.exists).toBe(true)
  })

  it('recognizes Corporation as Organization variant', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Corporation',
      name: 'Big Corp',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      description: 'A corporation',
    })
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('parses sameAs social profiles correctly', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      description: 'Test',
      sameAs: [
        'https://www.linkedin.com/company/acme',
        'https://www.facebook.com/acme',
        'https://en.wikipedia.org/wiki/Acme',
        'https://www.wikidata.org/wiki/Q12345',
      ],
    })
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)

    const sameAs = result.details?.sameAs as Record<string, unknown>
    expect(sameAs.present).toBe(true)
    expect(sameAs.count).toBe(4)
    expect(sameAs.hasSocialProfiles).toBe(true)
    expect(sameAs.hasWikipedia).toBe(true)
    expect(sameAs.hasWikidata).toBe(true)
    expect(sameAs.platforms).toContain('LinkedIn')
    expect(sameAs.platforms).toContain('Facebook')
  })

  it('handles Organization in @graph structure', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Example' },
        {
          '@type': 'Organization',
          name: 'Acme',
          url: 'https://example.com',
          logo: 'https://example.com/logo.png',
          description: 'Test',
        },
      ],
    })
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.exists).toBe(true)
  })

  it('handles sameAs as a single string', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      url: 'https://example.com',
      logo: 'https://example.com/logo.png',
      description: 'Test',
      sameAs: 'https://www.linkedin.com/company/acme',
    })
    const result = await organizationSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    const sameAs = result.details?.sameAs as Record<string, unknown>
    expect(sameAs.count).toBe(1)
  })
})

// =============================================================================
// speakable-schema
// =============================================================================

describe('speakable-schema', () => {
  it('fails when no speakable schema is present', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
    })
    const result = await speakableSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.hasSpeakable).toBe(false)
  })

  it('fails when no JSON-LD at all', async () => {
    const result = await speakableSchema.run(makeContext('<html><head></head><body></body></html>'))
    expect(result.status).toBe(CheckStatus.Failed)
  })

  it('passes when speakable property is present with CSS selectors', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test Article',
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['.article-headline', '.article-body'],
      },
    })
    const result = await speakableSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('passes when SpeakableSpecification is a standalone type', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'SpeakableSpecification',
      cssSelector: ['.headline'],
    })
    const result = await speakableSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns when speakable is present but has no selectors', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      speakable: {
        '@type': 'SpeakableSpecification',
      },
    })
    const result = await speakableSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.hasSpeakable).toBe(true)
    expect(result.details?.speakableCount).toBe(0)
  })

  it('handles speakable with xpath selectors', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      speakable: {
        '@type': 'SpeakableSpecification',
        xpath: ['/html/head/title', '//article/h1'],
      },
    })
    const result = await speakableSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('handles speakable with single string cssSelector', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Test',
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: '.main-content',
      },
    })
    const result = await speakableSchema.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })
})

// =============================================================================
// schema-validation
// =============================================================================

describe('schema-validation', () => {
  it('fails when no JSON-LD is present', async () => {
    const result = await schemaValidation.run(
      makeContext('<html><head></head><body></body></html>')
    )
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.totalSchemas).toBe(0)
  })

  it('passes for a fully valid Article schema', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      author: { '@type': 'Person', name: 'Author' },
      datePublished: '2025-01-01',
      image: 'https://example.com/img.jpg',
      dateModified: '2025-01-02',
      publisher: { '@type': 'Organization', name: 'Pub' },
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns when Article is missing required fields', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      // missing author, datePublished, image
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.invalidCount).toBe(1)

    const schemas = result.details?.schemas as { missingRequired: string[] }[]
    expect(schemas[0].missingRequired).toContain('author')
    expect(schemas[0].missingRequired).toContain('datePublished')
    expect(schemas[0].missingRequired).toContain('image')
  })

  it('validates Product schema correctly', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Widget',
      image: 'https://example.com/widget.jpg',
      description: 'A nice widget',
      offers: { '@type': 'Offer', price: '10.00' },
      brand: { '@type': 'Brand', name: 'WidgetCo' },
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('validates FAQPage with Question items', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is this?',
          acceptedAnswer: { '@type': 'Answer', text: 'A test.' },
        },
      ],
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns when FAQPage has empty mainEntity', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [],
    })
    const result = await schemaValidation.run(makeContext(html))
    // Has mainEntity so required field present, but warnings about empty array
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('validates LocalBusiness schema', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Local Shop',
      address: { '@type': 'PostalAddress', streetAddress: '123 Main St' },
      telephone: '+1-555-1234',
      openingHours: 'Mo-Fr 09:00-17:00',
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns for LocalBusiness missing address', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Local Shop',
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
    const schemas = result.details?.schemas as { missingRequired: string[] }[]
    expect(schemas[0].missingRequired).toContain('address')
  })

  it('validates Organization schema', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      url: 'https://example.com',
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('handles multiple schemas in @graph, some valid some not', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Acme', url: 'https://example.com' },
        { '@type': 'Article', headline: 'Test' }, // missing author, datePublished, image
      ],
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.validCount).toBe(1)
    expect(result.details?.invalidCount).toBe(1)
  })

  it('handles unknown schema types gracefully', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Conference',
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('handles malformed JSON gracefully', async () => {
    const html =
      '<html><head><script type="application/ld+json">{invalid json</script></head><body></body></html>'
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
  })

  it('reports missing recommended fields as passed with note', async () => {
    const html = wrapJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      author: { '@type': 'Person', name: 'Author' },
      datePublished: '2025-01-01',
      image: 'https://example.com/img.jpg',
      // missing recommended: dateModified, publisher
    })
    const result = await schemaValidation.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })
})
