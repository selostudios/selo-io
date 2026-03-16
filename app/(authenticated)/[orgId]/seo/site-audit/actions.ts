'use server'

import { getSiteAuditListData } from '@/lib/actions/audit-list-helpers'

// Re-export the helper with the expected name
export { getSiteAuditListData as getSiteAuditData }
