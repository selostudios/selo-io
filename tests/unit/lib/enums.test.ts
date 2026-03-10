import { UnifiedAuditStatus, CheckCategory, CrawlMode, ScoreDimension } from '@/lib/enums'

describe('Unified Audit Enums', () => {
  test('UnifiedAuditStatus has all required values', () => {
    expect(UnifiedAuditStatus.Pending).toBe('pending')
    expect(UnifiedAuditStatus.Crawling).toBe('crawling')
    expect(UnifiedAuditStatus.AwaitingConfirmation).toBe('awaiting_confirmation')
    expect(UnifiedAuditStatus.Checking).toBe('checking')
    expect(UnifiedAuditStatus.Completed).toBe('completed')
    expect(UnifiedAuditStatus.Failed).toBe('failed')
    expect(UnifiedAuditStatus.Stopped).toBe('stopped')
    expect(UnifiedAuditStatus.BatchComplete).toBe('batch_complete')
  })

  test('CheckCategory has all 10 categories', () => {
    expect(Object.values(CheckCategory)).toHaveLength(10)
    expect(CheckCategory.Crawlability).toBe('crawlability')
    expect(CheckCategory.MetaContent).toBe('meta_content')
    expect(CheckCategory.ContentStructure).toBe('content_structure')
    expect(CheckCategory.ContentQuality).toBe('content_quality')
    expect(CheckCategory.Links).toBe('links')
    expect(CheckCategory.Media).toBe('media')
    expect(CheckCategory.StructuredData).toBe('structured_data')
    expect(CheckCategory.Security).toBe('security')
    expect(CheckCategory.Performance).toBe('performance')
    expect(CheckCategory.AIVisibility).toBe('ai_visibility')
  })

  test('CrawlMode has standard and exhaustive', () => {
    expect(CrawlMode.Standard).toBe('standard')
    expect(CrawlMode.Exhaustive).toBe('exhaustive')
  })

  test('ScoreDimension has three dimensions', () => {
    expect(ScoreDimension.SEO).toBe('seo')
    expect(ScoreDimension.Performance).toBe('performance')
    expect(ScoreDimension.AIReadiness).toBe('ai_readiness')
  })
})
