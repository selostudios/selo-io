import { NextResponse } from 'next/server'
import { runPeriodicCleanup } from '@/lib/audit/cleanup'

/**
 * Periodic cleanup cron job for audit data.
 * - Deletes checks/pages from audits older than 6 months (keeps audit record)
 * - Deletes one-time audits older than 30 days entirely
 * - Cleans up orphaned crawl queue entries
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
    const results = await runPeriodicCleanup()

    console.log('[Cron Info]', {
      type: 'audit_cleanup_completed',
      timestamp: new Date().toISOString(),
      results,
    })

    return NextResponse.json({
      success: true,
      ...results,
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
