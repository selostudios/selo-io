import type { AuditCheckDefinition } from '../../types'
import { imagesMissingAlt } from './images-missing-alt'
import { oversizedImages } from './oversized-images'
import { mediaRichness } from './media-richness'

export const mediaChecks: AuditCheckDefinition[] = [
  imagesMissingAlt,
  oversizedImages,
  mediaRichness,
]

export { imagesMissingAlt, oversizedImages, mediaRichness }
