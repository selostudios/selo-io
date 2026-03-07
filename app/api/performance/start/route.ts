import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPerformanceAudit } from '@/lib/performance/runner'
import { getCurrentUser } from '@/lib/organizations/actions'

// Allow up to 10 minutes for the background audit to complete
export const maxDuration = 600

export async function POST(request: Request) {
  const supabase = await createClient()

  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { isInternal, organizationId: userOrgId } = currentUser

  // Get request body
  let body: { urls?: string[]; organizationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }
  const { urls, organizationId } = body

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'URLs are required' }, { status: 400 })
  }

  // Validate URLs
  for (const url of urls) {
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: `Invalid URL: ${url}` }, { status: 400 })
    }
  }

  // Determine the organization to associate the audit with
  let auditOrgId: string | null = null

  if (organizationId) {
    // If organizationId is provided, verify access
    if (isInternal) {
      // Internal users can audit any organization
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .single()

      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }
      auditOrgId = organizationId
    } else {
      // External users can only audit their own organization
      if (organizationId !== userOrgId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
      auditOrgId = organizationId
    }
  } else if (!isInternal) {
    // External users must always have an organizationId (their own)
    auditOrgId = userOrgId
  }
  // For internal users with no organizationId, auditOrgId remains null (one-time audit)

  // Create audit record
  const { data: audit, error } = await supabase
    .from('performance_audits')
    .insert({
      organization_id: auditOrgId,
      created_by: currentUser.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Performance API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start audit in background using after() to ensure it continues after response
  after(async () => {
    try {
      await runPerformanceAudit(audit.id, urls)
    } catch (err) {
      console.error('[Performance API] Background audit failed:', err)
      // Update audit status to failed so it doesn't stay stuck as 'pending'
      await supabase
        .from('performance_audits')
        .update({ status: 'failed' })
        .eq('id', audit.id)
        .in('status', ['pending', 'running'])
    }
  })

  return NextResponse.json({ auditId: audit.id })
}
