export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    firstName: 'Admin',
    lastName: 'User',
  },
  teamMember: {
    email: 'member@test.com',
    password: 'TestPassword123!',
    firstName: 'Team',
    lastName: 'Member',
  },
  viewer: {
    email: 'viewer@test.com',
    password: 'TestPassword123!',
    firstName: 'Client',
    lastName: 'Viewer',
  },
  developer: {
    email: 'developer@test.com',
    password: 'TestPassword123!',
    firstName: 'Developer',
    lastName: 'User',
  },
}

export const testOrganization = {
  name: 'Test Organization',
  primaryColor: '#000000',
  secondaryColor: '#F5F5F0',
  accentColor: '#666666',
}

export const testCampaign = {
  name: 'Test Campaign',
  description: 'A test campaign for E2E testing',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
}

export const testIndustries = {
  marketing: 'Marketing',
  software: 'Software',
  accounting: 'Accounting',
}

/**
 * Seeded performance review fixture used by the Phase 4 E2E and visual
 * regression suites. Stable UUIDs + tokens keep the tests deterministic so
 * navigation URLs and public-share URLs can be hard-coded in the specs
 * without needing an extra seed round-trip.
 */
export const testMarketingReview = {
  reviewId: '11111111-1111-4111-8111-111111111111',
  snapshotId: '22222222-2222-4222-8222-222222222222',
  quarter: '2026-Q1',
  title: '2026-Q1 Marketing Review',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  compareQoqStart: '2025-10-01',
  compareQoqEnd: '2025-12-31',
  compareYoyStart: '2025-01-01',
  compareYoyEnd: '2025-03-31',
  /** Token stored on the snapshot row itself (internal / not used for public access). */
  internalShareToken: 'seed-internal-token-11111111',
  /** Token used by the public /s/{token} share URL in E2E + visual tests. */
  publicShareToken: 'seed-public-share-token-22222222',
  narrative: {
    cover_subtitle: 'A strong quarter across all marketing channels.',
    ga_summary:
      'Sessions grew 18% quarter-over-quarter to 42,300, with engagement rate up to 63%. The biggest contributor was organic search, which added 6,500 sessions thanks to the new resource hub.',
    linkedin_insights:
      'Follower count increased 12% to 3,200. Impressions trended upward through February, and the Q1 thought-leadership series drove the three highest-engagement posts of the quarter.',
    content_highlights:
      'Founder-voice storytelling drove the top posts of the quarter — the common thread was specific, named moments that people could picture.',
    initiatives:
      'Launched the redesigned pricing page, shipped the product-led onboarding flow, and published ten new customer case studies. The content team also kicked off a quarterly webinar cadence.',
    takeaways:
      'Long-form content is our best top-of-funnel investment, organic is more durable than paid, and our case studies convert at roughly twice the rate of generic landing pages.',
    planning:
      'Double down on the content engine: expand the case-study library, invest in SEO for high-intent commercial keywords, and run a Q2 webinar on the buyer evaluation framework.',
  },
  /**
   * Snapshot `data` payload. We only populate the pieces the deck actually
   * reads from — `data.linkedin.top_posts` is what triggers the "What
   * Resonated" slide. The GA/LinkedIn metric strips degrade gracefully when
   * their metric blocks are empty, so we leave the rest unpopulated to keep
   * the fixture small and deterministic.
   *
   * `thumbnail_url: null` on every post is intentional: the seed does not
   * create storage objects, so null-thumbnails ensure the cards render the
   * deterministic `TextPostPlaceholder` gradient rather than a broken image.
   */
  data: {
    linkedin: {
      metrics: {},
      top_posts: [
        {
          id: 'urn:li:ugcPost:seed-1',
          url: 'https://linkedin.com/feed/update/urn:li:ugcPost:seed-1',
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
          id: 'urn:li:ugcPost:seed-2',
          url: 'https://linkedin.com/feed/update/urn:li:ugcPost:seed-2',
          thumbnail_url: null,
          caption:
            'Founder voice beats corporate voice by 3x on every metric we track. Here is the playbook.',
          posted_at: '2026-02-14',
          impressions: 9820,
          reactions: 189,
          comments: 12,
          shares: 24,
          engagement_rate: 0.0229,
        },
        {
          id: 'urn:li:ugcPost:seed-3',
          url: 'https://linkedin.com/feed/update/urn:li:ugcPost:seed-3',
          thumbnail_url: null,
          caption: 'Q1 customer interview takeaways in one slide.',
          posted_at: '2026-02-22',
          impressions: 7410,
          reactions: 148,
          comments: 9,
          shares: 14,
          engagement_rate: 0.0231,
        },
        {
          id: 'urn:li:ugcPost:seed-4',
          url: 'https://linkedin.com/feed/update/urn:li:ugcPost:seed-4',
          thumbnail_url: null,
          caption: 'We shipped a new onboarding flow. Early activation is up 40%.',
          posted_at: '2026-03-07',
          impressions: 6520,
          reactions: 130,
          comments: 8,
          shares: 11,
          engagement_rate: 0.0228,
        },
      ],
    },
  },
}

/**
 * Seeded style memo fixture. The memo is pre-loaded into
 * `marketing_review_style_memos` for the test org so the settings E2E can
 * verify the card renders a learned memo without having to trigger the live
 * learner LLM call (which would be slow, flaky, and costly in CI).
 */
export const testStyleMemo = {
  memo: 'Prefer punchy bullets. Tone: confident and consultative. Lead with deltas.',
  source: 'auto' as const,
  updatedAt: '2026-01-15T12:00:00Z',
}

/**
 * Seeded memo history rows. Ensures the settings timeline and snapshot-detail
 * callout have content to render without having to trigger the live learner.
 */
export const testStyleMemoVersions = {
  auto: {
    id: '33333333-3333-4333-8333-333333333333',
    snapshotId: testMarketingReview.snapshotId,
    memo: testStyleMemo.memo,
    rationale: 'Noticed author prefers punchy bullets; leaned into that.',
    source: 'auto' as const,
    createdBy: null,
    createdAt: '2026-01-15T12:00:00Z',
  },
  manual: {
    id: '44444444-4444-4444-8444-444444444444',
    snapshotId: null,
    memo: testStyleMemo.memo + ' Also emphasise YoY deltas.',
    rationale: null,
    source: 'manual' as const,
    createdBy: null, // filled in by seed.ts with the admin user id
    createdAt: '2026-01-20T12:00:00Z',
  },
}
