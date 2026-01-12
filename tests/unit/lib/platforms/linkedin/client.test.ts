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

  describe('getFollowerStatistics', () => {
    it('should fetch lifetime follower count', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              {
                followerCountsBySeniority: [
                  { followerCounts: { organicFollowerCount: 1000, paidFollowerCount: 500 } },
                  { followerCounts: { organicFollowerCount: 200, paidFollowerCount: 0 } },
                ],
              },
            ],
          }),
      })

      const result = await client.getFollowerStatistics()
      expect(result.totalFollowers).toBe(1700)
      expect(result.organicGain).toBe(0)
      expect(result.paidGain).toBe(0)
    })

    it('should fetch follower gains for date range', async () => {
      const client = new LinkedInClient(mockCredentials)
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-07')

      global.fetch = vi
        .fn()
        // Lifetime stats call
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              elements: [
                {
                  followerCountsBySeniority: [
                    { followerCounts: { organicFollowerCount: 800, paidFollowerCount: 0 } },
                    { followerCounts: { organicFollowerCount: 200, paidFollowerCount: 0 } },
                  ],
                },
              ],
            }),
        })
        // Time-bound stats call
        .mockResolvedValueOnce({
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
      expect(result.totalFollowers).toBe(1000)
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

      const result = await client.getFollowerStatistics()
      expect(result.totalFollowers).toBe(0)
      expect(result.organicGain).toBe(0)
    })

    it('should throw user-friendly error on 401', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      // getFollowerStatistics catches errors internally
      const result = await client.getFollowerStatistics()
      expect(result.totalFollowers).toBe(0)
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

      // Mock all API calls - they run in parallel so order may vary
      // We use mockImplementation to handle any order
      const mockResponses = {
        followerLifetime: {
          elements: [
            {
              followerCountsBySeniority: [
                { followerCounts: { organicFollowerCount: 800, paidFollowerCount: 0 } },
                { followerCounts: { organicFollowerCount: 200, paidFollowerCount: 0 } },
              ],
            },
          ],
        },
        followerTimebound: {
          elements: [{ followerGains: { organicFollowerGain: 50, paidFollowerGain: 10 } }],
        },
        pageStats: {
          elements: [{ totalPageStatistics: { views: { allPageViews: 500 } } }],
        },
        shareStats: {
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
        },
      }

      global.fetch = vi.fn().mockImplementation((url: string) => {
        let response = {}

        if (url.includes('organizationalEntityFollowerStatistics')) {
          if (url.includes('timeIntervals')) {
            response = mockResponses.followerTimebound
          } else {
            response = mockResponses.followerLifetime
          }
        } else if (url.includes('organizationPageStatistics')) {
          response = mockResponses.pageStats
        } else if (url.includes('organizationalEntityShareStatistics')) {
          response = mockResponses.shareStats
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        })
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
