import { NextResponse } from 'next/server'
import { runPeriodicCleanup } from '@/lib/audit/cleanup'
import { runUnifiedAuditCleanup } from '@/lib/unified-audit/cleanup'

/**
 * Periodic cleanup cron job for audit data.
 * - Old audit system: runs cleanup via database function
 * - Unified audit system: cleans up audit_checks/audit_pages for older audits
 *
 * Schedule: Weekly (recommended)
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Run cleanup for both old and unified audit systems
    const [legacyResults, unifiedResults] = await Promise.all([
      runPeriodicCleanup(),
      runUnifiedAuditCleanup(),
    ])

    console.log('[Cron Info]', {
      type: 'audit_cleanup_completed',
      timestamp: new Date().toISOString(),
      legacyResults,
      unifiedResults,
    })

    return NextResponse.json({
      success: true,
      legacy: legacyResults,
      unified: unifiedResults,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error('[Cron Error]', {
      type: 'audit_cleanup_failed',
      timestamp: new Date().toISOString(),
      error: errorMessage,
    })

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
