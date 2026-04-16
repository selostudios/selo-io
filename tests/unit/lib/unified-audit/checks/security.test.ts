import { describe, it, expect } from 'vitest'
import { CheckStatus, CheckCategory, ScoreDimension } from '@/lib/enums'
import { mixedContent } from '@/lib/unified-audit/checks/security/mixed-content'
import { sslCertificate } from '@/lib/unified-audit/checks/security/ssl-certificate'

describe('mixed-content', () => {
  it('fails when HTTPS page has HTTP images', async () => {
    const html = `
      <html><body>
        <img src="http://example.com/photo.jpg" alt="test">
        <img src="https://example.com/secure.jpg" alt="test">
      </body></html>
    `
    const result = await mixedContent.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.count).toBe(1)
  })

  it('passes when all resources use HTTPS', async () => {
    const html = `
      <html><body>
        <img src="https://example.com/photo.jpg" alt="test">
        <script src="https://cdn.example.com/app.js"></script>
        <link href="https://cdn.example.com/styles.css" rel="stylesheet">
      </body></html>
    `
    const result = await mixedContent.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('skips check for HTTP pages', async () => {
    const html = `
      <html><body>
        <img src="http://example.com/photo.jpg" alt="test">
      </body></html>
    `
    const result = await mixedContent.run({
      url: 'http://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.message as string).toContain('not applicable')
  })

  it('detects HTTP scripts', async () => {
    const html = `
      <html><body>
        <script src="http://cdn.example.com/analytics.js"></script>
      </body></html>
    `
    const result = await mixedContent.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    const resources = result.details?.resources as Array<{ type: string; url: string }>
    expect(resources[0].type).toBe('script')
  })

  it('detects HTTP resources in inline styles', async () => {
    const html = `
      <html><body>
        <div style="background-image: url('http://example.com/bg.jpg')">Content</div>
      </body></html>
    `
    const result = await mixedContent.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    const resources = result.details?.resources as Array<{ type: string; url: string }>
    expect(resources[0].type).toBe('inline style')
  })

  it('detects multiple insecure resource types', async () => {
    const html = `
      <html><body>
        <img src="http://example.com/img.jpg" alt="test">
        <script src="http://example.com/app.js"></script>
        <iframe src="http://example.com/widget"></iframe>
      </body></html>
    `
    const result = await mixedContent.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.count).toBe(3)
  })

  it('passes with no resources at all', async () => {
    const html = `<html><body><p>Plain text content</p></body></html>`
    const result = await mixedContent.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('detects HTTP video and audio sources', async () => {
    const html = `
      <html><body>
        <video src="http://cdn.example.com/video.mp4"></video>
        <audio src="http://cdn.example.com/audio.mp3"></audio>
      </body></html>
    `
    const result = await mixedContent.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.count).toBe(2)
  })

  it('has correct category and score dimensions', () => {
    expect(mixedContent.category).toBe(CheckCategory.Security)
    expect(mixedContent.feedsScores).toEqual([ScoreDimension.SEO])
  })
})

describe('ssl-certificate', () => {
  it('fails when site uses HTTP instead of HTTPS', async () => {
    const result = await sslCertificate.run({
      url: 'http://example.com',
      html: '',
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.issue).toBe('missing_https')
    expect(result.details?.message as string).toContain('HTTP instead of HTTPS')
  })

  it('has correct category, priority, and score dimensions', () => {
    expect(sslCertificate.category).toBe(CheckCategory.Security)
    expect(sslCertificate.feedsScores).toEqual([ScoreDimension.SEO])
    expect(sslCertificate.isSiteWide).toBe(true)
  })

  it('is a merged check covering both presence and validity', () => {
    // The unified ssl_certificate check replaces both missing-ssl and invalid-ssl-certificate
    expect(sslCertificate.name).toBe('ssl_certificate')
    expect(sslCertificate.displayName).toBe('SSL Certificate Issues')
    expect(sslCertificate.displayNamePassed).toBe('Valid SSL Certificate')
  })
})
