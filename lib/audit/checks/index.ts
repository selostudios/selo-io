import type { AuditCheckDefinition } from '@/lib/audit/types'
// SEO checks
import { missingMetaDescription } from './seo/missing-meta-description'
import { metaDescriptionLength } from './seo/meta-description-length'
import { missingTitle } from './seo/missing-title'
import { titleLength } from './seo/title-length'
import { missingH1 } from './seo/missing-h1'
import { multipleH1 } from './seo/multiple-h1'
import { headingHierarchy } from './seo/heading-hierarchy'
import { imagesMissingAlt } from './seo/images-missing-alt'
import { missingCanonical } from './seo/missing-canonical'
import { thinContent } from './seo/thin-content'

export const allChecks: AuditCheckDefinition[] = [
  // SEO - Critical
  missingMetaDescription,
  missingTitle,
  missingH1,
  // SEO - Recommended
  metaDescriptionLength,
  titleLength,
  multipleH1,
  headingHierarchy,
  imagesMissingAlt,
  missingCanonical,
  // SEO - Optional
  thinContent,
]

export function getChecksByType(
  type: 'seo' | 'ai_readiness' | 'technical'
): AuditCheckDefinition[] {
  return allChecks.filter((check) => check.type === type)
}
