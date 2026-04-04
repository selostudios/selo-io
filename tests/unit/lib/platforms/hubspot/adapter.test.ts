import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HubSpotAdapter } from '@/lib/platforms/hubspot/adapter'
import { HubSpotClient } from '@/lib/platforms/hubspot/client'
import type { HubSpotMetrics } from '@/lib/platforms/hubspot/types'

vi.mock('@/lib/platforms/hubspot/client')

describe('HubSpotAdapter', () => {
  const mockCredentials = {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_at: '2099-01-01',
    hub_id: '12345',
    hub_domain: 'test.hubspot.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(HubSpotClient).mockImplementation(function () {
      return {} as unknown as HubSpotClient
    })
  })

  describe('normalizeToDbRecords', () => {
    const sampleMetrics: HubSpotMetrics = {
      crm: {
        totalContacts: 1500,
        totalDeals: 45,
        newDeals: 8,
        totalPipelineValue: 250000,
        dealsWon: 3,
        dealsLost: 2,
      },
      marketing: {
        emailsSent: 500,
        emailsOpened: 200,
        emailsClicked: 50,
        openRate: 40,
        clickRate: 10,
        formSubmissions: 12,
      },
    }

    it('produces 7 records (6 CRM + 1 marketing)', () => {
      const adapter = new HubSpotAdapter(mockCredentials)
      const records = adapter.normalizeToDbRecords(sampleMetrics, 'org-1', new Date('2026-03-15'))

      expect(records).toHaveLength(7)
    })

    it('sets correct platform_type and organization_id on all records', () => {
      const adapter = new HubSpotAdapter(mockCredentials)
      const records = adapter.normalizeToDbRecords(sampleMetrics, 'org-1', new Date('2026-03-15'))

      for (const record of records) {
        expect(record.platform_type).toBe('hubspot')
        expect(record.organization_id).toBe('org-1')
        expect(record.campaign_id).toBeNull()
        expect(record.date).toBe('2026-03-15')
      }
    })

    it('maps CRM metrics to correct types', () => {
      const adapter = new HubSpotAdapter(mockCredentials)
      const records = adapter.normalizeToDbRecords(sampleMetrics, 'org-1', new Date('2026-03-15'))

      const byType = Object.fromEntries(records.map((r) => [r.metric_type, r.value]))
      expect(byType['hubspot_total_contacts']).toBe(1500)
      expect(byType['hubspot_total_deals']).toBe(45)
      expect(byType['hubspot_new_deals']).toBe(8)
      expect(byType['hubspot_total_pipeline_value']).toBe(250000)
      expect(byType['hubspot_deals_won']).toBe(3)
      expect(byType['hubspot_deals_lost']).toBe(2)
    })

    it('maps form submissions to correct type', () => {
      const adapter = new HubSpotAdapter(mockCredentials)
      const records = adapter.normalizeToDbRecords(sampleMetrics, 'org-1', new Date('2026-03-15'))

      const formSub = records.find((r) => r.metric_type === 'hubspot_form_submissions')
      expect(formSub?.value).toBe(12)
    })
  })
})
