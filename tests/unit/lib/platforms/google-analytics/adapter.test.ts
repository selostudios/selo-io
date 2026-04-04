import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoogleAnalyticsAdapter } from '@/lib/platforms/google-analytics/adapter'
import { GoogleAnalyticsClient } from '@/lib/platforms/google-analytics/client'
import type { GoogleAnalyticsDailyMetrics } from '@/lib/platforms/google-analytics/types'

vi.mock('@/lib/platforms/google-analytics/client')

describe('GoogleAnalyticsAdapter', () => {
  const mockCredentials = {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_at: '2099-01-01',
    property_id: '123456',
    property_name: 'Test Property',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(GoogleAnalyticsClient).mockImplementation(function () {
      return {} as unknown as GoogleAnalyticsClient
    })
  })

  describe('normalizeDailyMetricsToDbRecords', () => {
    const sampleDay: GoogleAnalyticsDailyMetrics = {
      date: '2026-03-15',
      activeUsers: 450,
      newUsers: 120,
      sessions: 600,
      trafficAcquisition: {
        direct: 200,
        organicSearch: 250,
        email: 50,
        organicSocial: 60,
        referral: 40,
      },
    }

    it('produces 8 records per day', () => {
      const adapter = new GoogleAnalyticsAdapter(mockCredentials)
      const records = adapter.normalizeDailyMetricsToDbRecords([sampleDay], 'org-1')

      expect(records).toHaveLength(8)
    })

    it('produces 16 records for 2 days', () => {
      const adapter = new GoogleAnalyticsAdapter(mockCredentials)
      const day2 = { ...sampleDay, date: '2026-03-16' }
      const records = adapter.normalizeDailyMetricsToDbRecords([sampleDay, day2], 'org-1')

      expect(records).toHaveLength(16)
    })

    it('sets correct metadata on all records', () => {
      const adapter = new GoogleAnalyticsAdapter(mockCredentials)
      const records = adapter.normalizeDailyMetricsToDbRecords([sampleDay], 'org-1')

      for (const record of records) {
        expect(record.platform_type).toBe('google_analytics')
        expect(record.organization_id).toBe('org-1')
        expect(record.campaign_id).toBeNull()
        expect(record.date).toBe('2026-03-15')
      }
    })

    it('maps all metric types with correct values', () => {
      const adapter = new GoogleAnalyticsAdapter(mockCredentials)
      const records = adapter.normalizeDailyMetricsToDbRecords([sampleDay], 'org-1')

      const byType = Object.fromEntries(records.map((r) => [r.metric_type, r.value]))
      expect(byType['ga_active_users']).toBe(450)
      expect(byType['ga_new_users']).toBe(120)
      expect(byType['ga_sessions']).toBe(600)
      expect(byType['ga_traffic_direct']).toBe(200)
      expect(byType['ga_traffic_organic_search']).toBe(250)
      expect(byType['ga_traffic_email']).toBe(50)
      expect(byType['ga_traffic_organic_social']).toBe(60)
      expect(byType['ga_traffic_referral']).toBe(40)
    })

    it('returns empty array for empty input', () => {
      const adapter = new GoogleAnalyticsAdapter(mockCredentials)
      const records = adapter.normalizeDailyMetricsToDbRecords([], 'org-1')

      expect(records).toHaveLength(0)
    })
  })
})
