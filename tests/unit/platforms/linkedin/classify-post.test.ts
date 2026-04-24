import { describe, test, expect } from 'vitest'
import { classifyPost } from '@/lib/platforms/linkedin/classify-post'
import { LinkedInPostType } from '@/lib/platforms/linkedin/post-types'

describe('classifyPost', () => {
  test('identifies a single-image post', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:1',
      createdAt: 0,
      commentary: 'hello',
      content: { media: { id: 'urn:li:image:abc' } },
    })
    expect(result.postType).toBe(LinkedInPostType.Image)
    expect(result.imageUrn).toBe('urn:li:image:abc')
    expect(result.caption).toBe('hello')
    expect(result.postUrl).toBe('https://www.linkedin.com/feed/update/urn:li:ugcPost:1')
  })

  test('identifies a multi-image post and takes the first image', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:2',
      createdAt: 0,
      content: { multiImage: { images: [{ id: 'urn:li:image:1' }, { id: 'urn:li:image:2' }] } },
    })
    expect(result.postType).toBe(LinkedInPostType.Image)
    expect(result.imageUrn).toBe('urn:li:image:1')
  })

  test('identifies a text post when no media/article/poll present', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:3',
      createdAt: 0,
      commentary: 'text only',
    })
    expect(result.postType).toBe(LinkedInPostType.Text)
    expect(result.imageUrn).toBeNull()
  })

  test('identifies an article post', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:4',
      createdAt: 0,
      content: { article: { source: 'https://x.com', title: 'x' } },
    })
    expect(result.postType).toBe(LinkedInPostType.Article)
    expect(result.imageUrn).toBeNull()
  })

  test('identifies a poll post', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:5',
      createdAt: 0,
      content: { poll: {} },
    })
    expect(result.postType).toBe(LinkedInPostType.Poll)
  })

  test('identifies a video post from a video URN in media.id', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:6',
      createdAt: 0,
      content: { media: { id: 'urn:li:video:xyz' } },
    })
    expect(result.postType).toBe(LinkedInPostType.Video)
    expect(result.imageUrn).toBeNull()
  })

  test('collapses empty or whitespace-only commentary to null', () => {
    const empty = classifyPost({ id: 'urn:li:ugcPost:7', createdAt: 0, commentary: '' })
    expect(empty.caption).toBeNull()

    const whitespace = classifyPost({
      id: 'urn:li:ugcPost:8',
      createdAt: 0,
      commentary: '   \n\t ',
    })
    expect(whitespace.caption).toBeNull()
  })
})
