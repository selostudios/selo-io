import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAIOAuditBackground } from '@/lib/aio/background'

// Extend function timeout for long-running audits
export const maxDuration = 300

interface StartAuditRequest {
  organizationId: string | null
  url: string
  sampleSize: number
}

/**
 * POST /api/aio/audit/start
 * Creates a AIO audit and returns the audit ID for navigation
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  try {
    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = (await req.json()) as StartAuditRequest
    const { organizationId, url, sampleSize } = body

    // Validate inputs
    if (!url || !sampleSize || sampleSize < 1 || sampleSize > 10) {
      return NextResponse.json(
        { error: 'Invalid request. URL and sampleSize (1-10) required.' },
        { status: 400 }
      )
    }

    // Create audit record
    const { data: audit, error: createError } = await supabase
      .from('aio_audits')
      .insert({
        organization_id: organizationId,
        created_by: user.id,
        url,
        status: 'pending',
        sample_size: sampleSize,
        ai_analysis_enabled: true,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (createError || !audit) {
      console.error('[AIO API] Failed to create audit:', createError)
      return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
    }

    // Start audit processing in background
    // This tells Vercel to keep the function running after the response is sent
    after(async () => {
      try {
        await runAIOAuditBackground(audit.id, url)
      } catch (err) {
        console.error('[AIO API] Background audit failed:', err)
      }
    })

    // Return audit ID for navigation
    return NextResponse.json({ auditId: audit.id })
  } catch (error) {
    console.error('[AIO API] Error starting audit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
