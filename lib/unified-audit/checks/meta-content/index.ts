import type { AuditCheckDefinition } from '../../types'

import { missingTitle } from './missing-title'
import { titleLength } from './title-length'
import { duplicateTitles } from './duplicate-titles'
import { missingMetaDescription } from './missing-meta-description'
import { metaDescriptionLength } from './meta-description-length'
import { duplicateMetaDescriptions } from './duplicate-meta-descriptions'
import { missingCanonical } from './missing-canonical'
import { canonicalValidation } from './canonical-validation'
import { missingViewport } from './missing-viewport'
import { missingOgTags } from './missing-og-tags'
import { missingFavicon } from './missing-favicon'

export {
  missingTitle,
  titleLength,
  duplicateTitles,
  missingMetaDescription,
  metaDescriptionLength,
  duplicateMetaDescriptions,
  missingCanonical,
  canonicalValidation,
  missingViewport,
  missingOgTags,
  missingFavicon,
}

export const metaContentChecks: AuditCheckDefinition[] = [
  missingTitle,
  titleLength,
  duplicateTitles,
  missingMetaDescription,
  metaDescriptionLength,
  duplicateMetaDescriptions,
  missingCanonical,
  canonicalValidation,
  missingViewport,
  missingOgTags,
  missingFavicon,
]
