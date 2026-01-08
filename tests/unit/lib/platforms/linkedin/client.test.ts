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

    it('should throw on API error', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      await expect(client.getFollowerCount()).rejects.toThrow('LinkedIn API error 401')
    })
  })

  describe('getPostEngagement', () => {
    it('should fetch engagement from recent posts', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              {
                id: 'post-1',
                socialMetadata: {
                  totalSocialActivityCounts: {
                    numLikes: 10,
                    numComments: 5,
                    numShares: 2,
                  },
                },
              },
              {
                id: 'post-2',
                socialMetadata: {
                  totalSocialActivityCounts: {
                    numLikes: 20,
                    numComments: 3,
                    numShares: 1,
                  },
                },
              },
            ],
          }),
      })

      const result = await client.getPostEngagement()
      expect(result.reactions).toBe(41) // 10+5+2 + 20+3+1
      expect(result.impressions).toBe(0) // Not available without MDP
    })

    it('should return zeros if posts endpoint fails', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      })

      const result = await client.getPostEngagement()
      expect(result.reactions).toBe(0)
      expect(result.impressions).toBe(0)
    })
  })

  describe('getAllMetrics', () => {
    it('should combine follower count and engagement', async () => {
      const client = new LinkedInClient(mockCredentials)

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ firstDegreeSize: 1000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              elements: [
                {
                  id: 'post-1',
                  socialMetadata: {
                    totalSocialActivityCounts: {
                      numLikes: 50,
                      numComments: 10,
                      numShares: 5,
                    },
                  },
                },
              ],
            }),
        })

      const result = await client.getAllMetrics(new Date(), new Date())
      expect(result.followers).toBe(1000)
      expect(result.reactions).toBe(65)
      expect(result.pageViews).toBe(0)
      expect(result.uniqueVisitors).toBe(0)
      expect(result.impressions).toBe(0)
    })
  })
})
