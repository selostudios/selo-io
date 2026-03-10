import type { AuditCheckDefinition } from '../../types'
import { sslCertificate } from './ssl-certificate'
import { mixedContent } from './mixed-content'

export const securityChecks: AuditCheckDefinition[] = [
  sslCertificate,
  mixedContent,
]

export { sslCertificate, mixedContent }
