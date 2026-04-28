import type {
  GAData,
  LinkedInData,
  MetricTriple,
  NarrativeBlocks,
  SnapshotData,
} from '@/lib/reviews/types'

/**
 * Shared fixtures for performance review unit tests. These build a realistic
 * org + narrative + snapshot triple so deck rendering tests can pass them in
 * without each test having to re-construct GA / LinkedIn metric shapes.
 *
 * The data shape mirrors `tests/fixtures/index.ts::testMarketingReview` so a
 * test fixture and the seed fixture stay aligned, but this module is fully
 * type-safe (no `as` casts) and available to unit tests that don't import
 * the seed-only fixture (which carries E2E-specific UUIDs/tokens).
 */
export const sampleOrg: {
  name: string
  logo_url: string | null
  primary_color: string | null
} = {
  name: 'Acme',
  logo_url: null,
  primary_color: '#abc123',
}

export const sampleNarrative: NarrativeBlocks = {
  cover_subtitle: 'A strong start to the year — Q1 across all marketing channels.',
  ga_summary:
    'Sessions grew 18% quarter-over-quarter to 42,300, with engagement rate up to 63%. Organic search added 6,500 sessions, driven by the new resource hub.',
  linkedin_insights:
    'Follower count increased 12% to 3,200. Impressions trended upward through February, and the Q1 thought-leadership series drove our three highest-engagement posts.',
  content_highlights:
    'Founder-voice storytelling drove the top posts — the common thread was specific, named moments that people could picture.',
  initiatives:
    'Launched the redesigned pricing page, shipped the product-led onboarding flow, and published ten new customer case studies.',
  takeaways:
    'Long-form content is our best top-of-funnel investment, organic is more durable than paid, and case studies convert at twice the rate of generic landing pages.',
  planning:
    'Double down on the content engine: expand the case-study library, invest in SEO for high-intent commercial keywords, and run a Q2 webinar.',
}

function makeTriple(current: number, qoq: number, yoy: number): MetricTriple {
  const qoqDelta = qoq === 0 ? null : (current - qoq) / qoq
  const yoyDelta = yoy === 0 ? null : (current - yoy) / yoy
  return {
    current,
    qoq,
    yoy,
    qoq_delta_pct: qoqDelta,
    yoy_delta_pct: yoyDelta,
  }
}

const sampleGa: GAData = {
  ga_sessions: makeTriple(42300, 35850, 28100),
  ga_engagement_rate: makeTriple(0.63, 0.58, 0.51),
  ga_users: makeTriple(31200, 26900, 21400),
}

const sampleLinkedIn: LinkedInData = {
  metrics: {
    linkedin_impressions: makeTriple(184000, 162000, 121000),
    linkedin_engagement_rate: makeTriple(0.034, 0.029, 0.024),
    linkedin_followers: makeTriple(3200, 2860, 2310),
  },
  top_posts: [
    {
      id: 'urn:li:ugcPost:fixture-1',
      url: 'https://linkedin.com/feed/update/urn:li:ugcPost:fixture-1',
      thumbnail_url: null,
      caption:
        'The five questions we ask every new customer in week one. Short version: we care more about their last win than their next goal.',
      posted_at: '2026-02-01',
      impressions: 12450,
      reactions: 243,
      comments: 18,
      shares: 31,
      engagement_rate: 0.0234,
    },
    {
      id: 'urn:li:ugcPost:fixture-2',
      url: 'https://linkedin.com/feed/update/urn:li:ugcPost:fixture-2',
      thumbnail_url: null,
      caption: 'Founder voice beats corporate voice by 3x on every metric we track.',
      posted_at: '2026-02-14',
      impressions: 9820,
      reactions: 189,
      comments: 12,
      shares: 24,
      engagement_rate: 0.0229,
    },
    {
      id: 'urn:li:ugcPost:fixture-3',
      url: 'https://linkedin.com/feed/update/urn:li:ugcPost:fixture-3',
      thumbnail_url: null,
      caption: 'Q1 customer interview takeaways in one slide.',
      posted_at: '2026-02-22',
      impressions: 7410,
      reactions: 148,
      comments: 9,
      shares: 14,
      engagement_rate: 0.0231,
    },
  ],
}

export const sampleSnapshotData: SnapshotData = {
  ga: sampleGa,
  linkedin: sampleLinkedIn,
}
