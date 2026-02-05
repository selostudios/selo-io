'use server'

import { getPerformanceAuditListData } from '@/lib/actions/audit-list-helpers'

// Re-export the helper with the expected name
export { getPerformanceAuditListData as getPageSpeedData }
