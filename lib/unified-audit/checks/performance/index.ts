import type { AuditCheckDefinition } from '../../types'
import { pageResponseTime } from './page-response-time'
import { lighthouseScores } from './lighthouse-scores'
import { coreWebVitals } from './core-web-vitals'
import { mobileFriendly } from './mobile-friendly'

export const performanceChecks: AuditCheckDefinition[] = [
  pageResponseTime,
  lighthouseScores,
  coreWebVitals,
  mobileFriendly,
]

export { pageResponseTime, lighthouseScores, coreWebVitals, mobileFriendly }
