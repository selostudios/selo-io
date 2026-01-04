import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

describe('LinkedInClient', () => {
  const mockCredentials = {
    access_token: 'test-token',
    organization_id: '12345678',
  }

  describe('constructor', () => {
    it('should create client with credentials', () => {
      const client = new LinkedInClient(mockCredentials)
      expect(client).toBeDefined()
    })
  })

  describe('getFollowerStatistics', () => {
    it('should fetch follower statistics for date range', async () => {
      const client = new LinkedInClient(mockCredentials)
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-07')

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          elements: [{
            followerGains: { organicFollowerGain: 25, paidFollowerGain: 5 }
          }]
        })
      })

      const result = await client.getFollowerStatistics(startDate, endDate)
      expect(result.followers).toBe(30)
    })

    it('should throw on API error', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(client.getFollowerStatistics(new Date(), new Date()))
        .rejects.toThrow('LinkedIn API error: 401')
    })
  })

  describe('getPageStatistics', () => {
    it('should fetch page views and unique visitors', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          elements: [{
            views: {
              allPageViews: { pageViews: 500 },
              uniqueVisitors: 250
            }
          }]
        })
      })

      const result = await client.getPageStatistics(new Date(), new Date())
      expect(result.pageViews).toBe(500)
      expect(result.uniqueVisitors).toBe(250)
    })
  })

  describe('getShareStatistics', () => {
    it('should fetch impressions and reactions', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          elements: [{
            totalShareStatistics: {
              impressionCount: 3000,
              reactionCount: 50
            }
          }]
        })
      })

      const result = await client.getShareStatistics(new Date(), new Date())
      expect(result.impressions).toBe(3000)
      expect(result.reactions).toBe(50)
    })
  })
})
