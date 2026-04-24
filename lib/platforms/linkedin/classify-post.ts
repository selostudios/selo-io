import type { LinkedInRawPost } from './client'
import { LinkedInPostType } from './post-types'

export interface ClassifiedPost {
  postType: LinkedInPostType
  caption: string | null
  postUrl: string
  /** First image URN for thumbnail fetch; null for text/video/article/poll. */
  imageUrn: string | null
}

/**
 * Classify a raw LinkedIn post (as returned by `LinkedInClient.listPosts()`)
 * into the normalised shape used by the posts table and downstream renderers.
 *
 * Pure synchronous — no network, no DB.
 */
export function classifyPost(raw: LinkedInRawPost): ClassifiedPost {
  const content = raw.content
  let postType: LinkedInPostType
  let imageUrn: string | null = null

  const multiImages = content?.multiImage?.images
  const mediaId = content?.media?.id

  if (multiImages && multiImages.length > 0) {
    postType = LinkedInPostType.Image
    imageUrn = multiImages[0]?.id ?? null
  } else if (mediaId) {
    if (mediaId.startsWith('urn:li:video:')) {
      postType = LinkedInPostType.Video
    } else {
      postType = LinkedInPostType.Image
      imageUrn = mediaId
    }
  } else if (content?.article) {
    postType = LinkedInPostType.Article
  } else if (content?.poll) {
    postType = LinkedInPostType.Poll
  } else {
    postType = LinkedInPostType.Text
  }

  const trimmed = raw.commentary?.trim()
  const caption = trimmed ? trimmed : null

  return {
    postType,
    caption,
    postUrl: `https://www.linkedin.com/feed/update/${raw.id}`,
    imageUrn,
  }
}
