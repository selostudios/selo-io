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
    initiatives:
      'Launched the redesigned pricing page, shipped the product-led onboarding flow, and published ten new customer case studies. The content team also kicked off a quarterly webinar cadence.',
    takeaways:
      'Long-form content is our best top-of-funnel investment, organic is more durable than paid, and our case studies convert at roughly twice the rate of generic landing pages.',
    planning:
      'Double down on the content engine: expand the case-study library, invest in SEO for high-intent commercial keywords, and run a Q2 webinar on the buyer evaluation framework.',
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
