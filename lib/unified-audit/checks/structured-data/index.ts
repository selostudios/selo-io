import type { AuditCheckDefinition } from '../../types'
import { schemaMarkup } from './schema-markup'
import { organizationSchema } from './organization-schema'
import { speakableSchema } from './speakable-schema'
import { schemaValidation } from './schema-validation'

export const structuredDataChecks: AuditCheckDefinition[] = [
  schemaMarkup,
  organizationSchema,
  speakableSchema,
  schemaValidation,
]

export { schemaMarkup, organizationSchema, speakableSchema, schemaValidation }
