import { describe, it, expect, vi } from 'vitest'
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

  describe('getFollowerCount', () => {
    it('should fetch total follower count', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            firstDegreeSize: 1500,
          }),
      })

      const result = await client.getFollowerCount()
      expect(result).toBe(1500)
    })

    it('should throw user-friendly error on 401', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      await expect(client.getFollowerCount()).rejects.toThrow(
        'LinkedIn token expired or invalid. Please reconnect your account.'
      )
    })
  })

  describe('getFollowerStatistics', () => {
    it('should fetch follower gains for date range', async () => {
      const client = new LinkedInClient(mockCredentials)
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-07')

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              { followerGains: { organicFollowerGain: 25, paidFollowerGain: 5 } },
              { followerGains: { organicFollowerGain: 10, paidFollowerGain: 0 } },
            ],
          }),
      })

      const result = await client.getFollowerStatistics(startDate, endDate)
      expect(result.organicGain).toBe(35)
      expect(result.paidGain).toBe(5)
    })

    it('should return zeros on error', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      })

      const result = await client.getFollowerStatistics(new Date(), new Date())
      expect(result.organicGain).toBe(0)
      expect(result.paidGain).toBe(0)
    })
  })

  describe('getShareStatistics', () => {
    it('should fetch engagement stats', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              {
                totalShareStatistics: {
                  impressionCount: 5000,
                  clickCount: 100,
                  likeCount: 50,
                  commentCount: 10,
                  shareCount: 5,
                  engagement: 0.033,
                },
              },
            ],
          }),
      })

      const result = await client.getShareStatistics()
      expect(result.impressions).toBe(5000)
      expect(result.clicks).toBe(100)
      expect(result.likes).toBe(50)
      expect(result.comments).toBe(10)
      expect(result.shares).toBe(5)
    })
  })

  describe('getAllMetrics', () => {
    it('should combine all metrics', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi
        .fn()
        // getFollowerCount
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ firstDegreeSize: 1000 }),
        })
        // getFollowerStatistics
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              elements: [{ followerGains: { organicFollowerGain: 50, paidFollowerGain: 10 } }],
            }),
        })
        // getPageStatistics
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              elements: [{ totalPageStatistics: { views: { allPageViews: 500 } } }],
            }),
        })
        // getShareStatistics
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              elements: [
                {
                  totalShareStatistics: {
                    impressionCount: 3000,
                    likeCount: 100,
                    commentCount: 20,
                    shareCount: 10,
                  },
                },
              ],
            }),
        })

      const result = await client.getAllMetrics(new Date(), new Date())
      expect(result.followers).toBe(1000)
      expect(result.followerGrowth).toBe(60)
      expect(result.pageViews).toBe(500)
      expect(result.impressions).toBe(3000)
      expect(result.reactions).toBe(130)
    })
  })
})
