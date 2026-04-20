import { describe, test, expect } from 'vitest'
import { buildPromptContextPayload } from '@/lib/reviews/narrative/context'
import type { SnapshotData } from '@/lib/reviews/types'

describe('buildPromptContextPayload', () => {
  test('rounds numeric fields to two decimal places', () => {
    const data: SnapshotData = {
      ga: {
        ga_sessions: {
          current: 1000.4567,
          qoq: 900,
          yoy: 850,
          qoq_delta_pct: 11.1111,
          yoy_delta_pct: 17.6,
        },
      },
    }
    const payload = buildPromptContextPayload(data)
    expect(payload.ga?.ga_sessions).toEqual({
      current: 1000.46,
      qoq: 900,
      yoy: 850,
      qoq_delta_pct: 11.11,
      yoy_delta_pct: 17.6,
    })
  })

  test('strips timeseries arrays from every metric', () => {
    const data: SnapshotData = {
      ga: {
        ga_sessions: {
          current: 50,
          qoq: 40,
          yoy: null,
          qoq_delta_pct: 25,
          yoy_delta_pct: null,
          timeseries: {
            current: [{ date: '2026-01-01', value: 50 }],
            qoq: [{ date: '2025-10-01', value: 40 }],
            yoy: [],
          },
        },
      },
      linkedin: {
        metrics: {
          linkedin_impressions: {
            current: 1200,
            qoq: 1000,
            yoy: null,
            qoq_delta_pct: 20,
            yoy_delta_pct: null,
            timeseries: {
              current: [{ date: '2026-02-01', value: 600 }],
              qoq: [],
              yoy: [],
            },
          },
        },
      },
    }
    const payload = buildPromptContextPayload(data)
    expect(JSON.stringify(payload)).not.toContain('timeseries')
  })

  test('preserves null values for missing qoq / yoy comparisons', () => {
    const data: SnapshotData = {
      ga: {
        ga_users: {
          current: 500,
          qoq: null,
          yoy: null,
          qoq_delta_pct: null,
          yoy_delta_pct: null,
        },
      },
    }
    const payload = buildPromptContextPayload(data)
    expect(payload.ga?.ga_users).toEqual({
      current: 500,
      qoq: null,
      yoy: null,
      qoq_delta_pct: null,
      yoy_delta_pct: null,
    })
  })

  test('truncates long LinkedIn post captions to 160 characters with an ellipsis', () => {
    const longCaption = 'a'.repeat(300)
    const data: SnapshotData = {
      linkedin: {
        metrics: {},
        top_posts: [
          {
            id: 'p1',
            url: 'https://linkedin.com/p/1',
            thumbnail_url: null,
            caption: longCaption,
            posted_at: '2026-02-15',
            impressions: 1000,
            reactions: 50,
            comments: 5,
            shares: 2,
            engagement_rate: 0.057,
          },
        ],
      },
    }
    const payload = buildPromptContextPayload(data)
    const post = payload.linkedin?.top_posts?.[0]
    expect(post?.caption?.length).toBe(160)
    expect(post?.caption?.endsWith('…')).toBe(true)
  })

  test('passes audit data through untouched', () => {
    const data: SnapshotData = {
      audit: {
        audit_id: 'audit-1',
        seo_score: 82,
        performance_score: 74,
        ai_readiness_score: 68,
        top_failed_checks: [
          {
            id: 'c1',
            check_name: 'missing_h1',
            display_name: 'Missing H1',
            priority: 'critical',
            category: 'content_structure',
          },
        ],
      },
    }
    const payload = buildPromptContextPayload(data)
    expect(payload.audit).toEqual(data.audit)
  })

  test('omits platform keys when the snapshot has no data for them', () => {
    const payload = buildPromptContextPayload({})
    expect(payload).toEqual({})
  })
})
