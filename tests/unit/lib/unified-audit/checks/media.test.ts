import { describe, it, expect } from 'vitest'
import { CheckStatus, CheckCategory, ScoreDimension } from '@/lib/enums'
import { imagesMissingAlt } from '@/lib/unified-audit/checks/media/images-missing-alt'
import { mediaRichness } from '@/lib/unified-audit/checks/media/media-richness'

describe('images-missing-alt', () => {
  it('fails when images have no alt attribute', async () => {
    const html = `
      <html><body>
        <img src="/photo1.jpg">
        <img src="/photo2.jpg">
      </body></html>
    `
    const result = await imagesMissingAlt.run({
      url: 'https://example.com',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.count).toBe(2)
  })

  it('passes when all images have alt attributes', async () => {
    const html = `
      <html><body>
        <img src="/photo1.jpg" alt="A sunset over the ocean">
        <img src="/photo2.jpg" alt="Team photo at the office">
      </body></html>
    `
    const result = await imagesMissingAlt.run({
      url: 'https://example.com',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.totalImages).toBe(2)
  })

  it('passes when images have empty alt (decorative)', async () => {
    const html = `
      <html><body>
        <img src="/decoration.jpg" alt="">
      </body></html>
    `
    const result = await imagesMissingAlt.run({
      url: 'https://example.com',
      html,
    })

    // Empty alt="" is valid (marks decorative images)
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('passes when no images are present', async () => {
    const html = `<html><body><p>No images here</p></body></html>`
    const result = await imagesMissingAlt.run({
      url: 'https://example.com',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
    expect((result.details?.message as string)).toContain('No images found')
  })

  it('correctly counts mixed images (some with alt, some without)', async () => {
    const html = `
      <html><body>
        <img src="/with-alt.jpg" alt="Description">
        <img src="/no-alt-1.jpg">
        <img src="/no-alt-2.jpg">
      </body></html>
    `
    const result = await imagesMissingAlt.run({
      url: 'https://example.com',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.count).toBe(2)
  })

  it('has correct category and score dimensions', () => {
    expect(imagesMissingAlt.category).toBe(CheckCategory.Media)
    expect(imagesMissingAlt.feedsScores).toContain(ScoreDimension.SEO)
    expect(imagesMissingAlt.feedsScores).toContain(ScoreDimension.AIReadiness)
  })
})

describe('media-richness', () => {
  it('warns when long content has no media', async () => {
    // Generate 900+ words of content
    const words = Array(200).fill('lorem ipsum dolor sit amet').join(' ')
    const html = `
      <html><body>
        <main><p>${words}</p></main>
      </body></html>
    `
    const result = await mediaRichness.run({
      url: 'https://example.com/article',
      html,
    })

    expect(result.status).toBe(CheckStatus.Warning)
    expect((result.details?.message as string)).toContain('No images or videos')
  })

  it('passes when short content has no media', async () => {
    const html = `
      <html><body>
        <main><p>Short page with just a few words of content here.</p></main>
      </body></html>
    `
    const result = await mediaRichness.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('passes with media that has good alt text', async () => {
    const html = `
      <html><body>
        <main>
          <p>Some content about our company and what we do every day.</p>
          <img src="/team.jpg" alt="Our team collaborating in the modern office space">
          <img src="/product.jpg" alt="Screenshot of the product dashboard showing key metrics">
        </main>
      </body></html>
    `
    const result = await mediaRichness.run({
      url: 'https://example.com/about',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.totalMedia).toBe(2)
  })

  it('fails when most images lack alt text', async () => {
    const html = `
      <html><body>
        <main>
          <p>Content with images</p>
          <img src="/img1.jpg">
          <img src="/img2.jpg">
          <img src="/img3.jpg">
          <img src="/img4.jpg" alt="One with alt text that is descriptive enough">
        </main>
      </body></html>
    `
    const result = await mediaRichness.run({
      url: 'https://example.com/gallery',
      html,
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect((result.details?.altTextCoverage as number)).toBeLessThan(50)
  })

  it('counts videos including YouTube iframes', async () => {
    const html = `
      <html><body>
        <main>
          <p>Watch our presentation</p>
          <iframe src="https://www.youtube.com/embed/abc123"></iframe>
          <img src="/thumbnail.jpg" alt="Video thumbnail showing the speaker at the podium">
        </main>
      </body></html>
    `
    const result = await mediaRichness.run({
      url: 'https://example.com/videos',
      html,
    })

    expect(result.details?.videos).toBe(1)
    expect(result.details?.images).toBe(1)
    expect(result.details?.totalMedia).toBe(2)
  })

  it('warns when alt text is present but too short', async () => {
    const html = `
      <html><body>
        <main>
          <p>Some content</p>
          <img src="/img1.jpg" alt="logo">
          <img src="/img2.jpg" alt="photo">
        </main>
      </body></html>
    `
    const result = await mediaRichness.run({
      url: 'https://example.com/page',
      html,
    })

    // Alt text exists (100% coverage) but not "good" (< 5 words)
    expect(result.status).toBe(CheckStatus.Warning)
    expect((result.details?.altTextCoverage as number)).toBe(100)
    expect((result.details?.imagesWithGoodAlt as number)).toBe(0)
  })

  it('has correct category and score dimensions', () => {
    expect(mediaRichness.category).toBe(CheckCategory.Media)
    expect(mediaRichness.feedsScores).toEqual([ScoreDimension.AIReadiness])
  })
})
