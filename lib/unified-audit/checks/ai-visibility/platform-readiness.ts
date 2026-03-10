import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckResult } from '../../types'

export const platformReadiness: AuditCheckDefinition = {
  name: 'platform_readiness',
  category: CheckCategory.AIVisibility,
  priority: CheckPriority.Recommended,
  description:
    'Assesses readiness for AI platforms — detailed scoring is provided during the AI analysis phase',
  displayName: 'Platform Readiness Pending',
  displayNamePassed: 'Platform Readiness Assessed',
  learnMoreUrl: null,
  isSiteWide: false,
  feedsScores: [ScoreDimension.AIReadiness],

  async run(): Promise<CheckResult> {
    return {
      status: CheckStatus.Passed,
      details: {
        message: 'Platform readiness assessed during AI analysis phase',
        requiresAIAnalysis: true,
      },
    }
  },
}
