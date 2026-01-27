import { describe, expect, it } from 'vitest'
import { faqSection } from '@/lib/aio/checks/content-structure/faq-section'
import type { AIOCheckContext } from '@/lib/aio/types'

describe('faqSection check', () => {
  it('should pass when FAQPage schema is present', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is AIO?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Artificial Intelligence Optimization"
                }
              }
            ]
          }
          </script>
        </head>
        <body>
          <h2>Frequently Asked Questions</h2>
        </body>
      </html>
    `

    const context: AIOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await faqSection.run(context)

    expect(result.status).toBe('passed')
    expect(result.details?.message).toContain('FAQPage schema')
  })

  it('should warn when FAQ content exists but schema is missing', async () => {
    const html = `
      <html>
        <body>
          <h2>Frequently Asked Questions</h2>
          <dl>
            <dt>What is AIO?</dt>
            <dd>Artificial Intelligence Optimization</dd>
          </dl>
        </body>
      </html>
    `

    const context: AIOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await faqSection.run(context)

    expect(result.status).toBe('warning')
    expect(result.details?.message).toContain('missing FAQPage schema')
  })

  it('should fail when no FAQ content is found', async () => {
    const html = `
      <html>
        <body>
          <h1>About Us</h1>
          <p>We are a company.</p>
        </body>
      </html>
    `

    const context: AIOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await faqSection.run(context)

    expect(result.status).toBe('failed')
    expect(result.details?.message).toContain('No FAQ section detected')
  })

  it('should detect details/summary elements', async () => {
    const html = `
      <html>
        <body>
          <h2>FAQ</h2>
          <details>
            <summary>What is AIO?</summary>
            <p>Artificial Intelligence Optimization</p>
          </details>
          <details>
            <summary>Why is AIO important?</summary>
            <p>It helps AI engines cite your content</p>
          </details>
        </body>
      </html>
    `

    const context: AIOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await faqSection.run(context)

    expect(result.status).toBe('warning')
    expect(result.details?.indicators).toContain('2 details/summary elements')
  })
})
