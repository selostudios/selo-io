import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinkedInAdapter } from '@/lib/platforms/linkedin/adapter'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

vi.mock('@/lib/platforms/linkedin/client')

describe('LinkedInAdapter', () => {
  const mockCredentials = {
    access_token: 'test-token',
    organization_id: '12345678',
  }

  const mockGetAllMetrics = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(LinkedInClient).mockImplementation(function () {
      return {
        getAllMetrics: mockGetAllMetrics,
      } as unknown as LinkedInClient
    })
  })

  describe('fetchMetrics', () => {
    it('should fetch all metrics for a date range', async () => {
      mockGetAllMetrics.mockResolvedValue({
        followers: 30,
        followerGrowth: 5,
        pageViews: 500,
        uniqueVisitors: 250,
        impressions: 3000,
        reactions: 50,
      })

      const adapter = new LinkedInAdapter(mockCredentials)
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-07')

      const metrics = await adapter.fetchMetrics(startDate, endDate)

      expect(metrics).toEqual({
        followers: 30,
        followerGrowth: 5,
        pageViews: 500,
        uniqueVisitors: 250,
        impressions: 3000,
        reactions: 50,
      })
    })
  })

  describe('normalizeToDbRecords', () => {
    it('should convert metrics to database records', () => {
      const adapter = new LinkedInAdapter(mockCredentials)
      const metrics = {
        followers: 30,
        followerGrowth: 5,
        pageViews: 500,
        uniqueVisitors: 250,
        impressions: 3000,
        reactions: 50,
      }
      const orgId = 'org-123'
      const date = new Date('2026-01-07')

      const records = adapter.normalizeToDbRecords(metrics, orgId, date)

      expect(records).toHaveLength(6)
      expect(records).toContainEqual({
        organization_id: orgId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: '2026-01-07',
        metric_type: 'linkedin_followers',
        value: 30,
      })
      expect(records).toContainEqual({
        organization_id: orgId,
        campaign_id: null,
        platform_type: 'linkedin',
        date: '2026-01-07',
        metric_type: 'linkedin_follower_growth',
        value: 5,
      })
    })
  })

  describe('normalizeDailyMetricsToDbRecords', () => {
    it('produces 6 records per day', () => {
      const adapter = new LinkedInAdapter(mockCredentials)
      const dailyMetrics = [
        {
          date: '2026-03-15',
          followers: 100,
          followerGrowth: 5,
          pageViews: 200,
          uniqueVisitors: 80,
          impressions: 500,
          reactions: 20,
        },
      ]

      const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, 'org-1')
      expect(records).toHaveLength(6)
    })

    it('maps all metric types correctly', () => {
      const adapter = new LinkedInAdapter(mockCredentials)
      const dailyMetrics = [
        {
          date: '2026-03-15',
          followers: 100,
          followerGrowth: 5,
          pageViews: 200,
          uniqueVisitors: 80,
          impressions: 500,
          reactions: 20,
        },
      ]

      const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, 'org-1')
      const byType = Object.fromEntries(records.map((r) => [r.metric_type, r.value]))

      expect(byType['linkedin_followers']).toBe(100)
      expect(byType['linkedin_follower_growth']).toBe(5)
      expect(byType['linkedin_page_views']).toBe(200)
      expect(byType['linkedin_unique_visitors']).toBe(80)
      expect(byType['linkedin_impressions']).toBe(500)
      expect(byType['linkedin_reactions']).toBe(20)
    })

    it('produces 12 records for 2 days', () => {
      const adapter = new LinkedInAdapter(mockCredentials)
      const dailyMetrics = [
        {
          date: '2026-03-15',
          followers: 100,
          followerGrowth: 5,
          pageViews: 200,
          uniqueVisitors: 80,
          impressions: 500,
          reactions: 20,
        },
        {
          date: '2026-03-16',
          followers: 105,
          followerGrowth: 5,
          pageViews: 210,
          uniqueVisitors: 85,
          impressions: 520,
          reactions: 22,
        },
      ]

      const records = adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, 'org-1')
      expect(records).toHaveLength(12)
    })
  })
})
