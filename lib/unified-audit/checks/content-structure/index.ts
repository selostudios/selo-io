import type { AuditCheckDefinition } from '@/lib/unified-audit/types'
import { missingH1 } from './missing-h1'
import { multipleH1 } from './multiple-h1'
import { headingHierarchy } from './heading-hierarchy'
import { faqSection } from './faq-section'
import { definitionBoxes } from './definition-boxes'
import { stepByStepGuides } from './step-by-step-guides'
import { summarySections } from './summary-sections'
import { citationFormat } from './citation-format'
import { comparisonTables } from './comparison-tables'

export {
  missingH1,
  multipleH1,
  headingHierarchy,
  faqSection,
  definitionBoxes,
  stepByStepGuides,
  summarySections,
  citationFormat,
  comparisonTables,
}

export const contentStructureChecks: AuditCheckDefinition[] = [
  missingH1,
  multipleH1,
  headingHierarchy,
  faqSection,
  definitionBoxes,
  stepByStepGuides,
  summarySections,
  citationFormat,
  comparisonTables,
]
