import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAuditBatch } from '@/lib/audit/runner'

// Extend function timeout for long-running audits (max 300s on Pro plan)
export const maxDuration = 800

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get request body
  const body = await request.json().catch(() => ({}))
  const { organizationId, url } = body as { organizationId?: string; url?: string }

  // Get user record with is_internal flag
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const isInternal = userRecord.is_internal === true

  let websiteUrl: string
  let auditOrganizationId: string | null = null

  // Handle three scenarios:
  // 1. URL provided with organizationId: Use URL, link to org (verify access)
  // 2. URL provided without organizationId: One-time audit (internal only)
  // 3. organizationId without URL: Get URL from org's website_url field

  if (url && organizationId) {
    // Scenario 1: URL provided with organizationId
    // Verify user has access to this organization
    if (!isInternal && organizationId !== userRecord.organization_id) {
      return NextResponse.json({ error: 'Unauthorized to audit this organization' }, { status: 403 })
    }

    websiteUrl = url
    auditOrganizationId = organizationId
  } else if (url && !organizationId) {
    // Scenario 2: URL provided without organizationId (one-time audit)
    // Only internal users can do one-time audits
    if (!isInternal) {
      return NextResponse.json(
        { error: 'Organization ID required for external users' },
        { status: 400 }
      )
    }

    websiteUrl = url
    auditOrganizationId = null
  } else if (organizationId && !url) {
    // Scenario 3: organizationId without URL - get from org's website_url
    // Verify user has access to this organization
    if (!isInternal && organizationId !== userRecord.organization_id) {
      return NextResponse.json({ error: 'Unauthorized to audit this organization' }, { status: 403 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('website_url')
      .eq('id', organizationId)
      .single()

    if (!org?.website_url) {
      return NextResponse.json({ error: 'No website URL configured for organization' }, { status: 400 })
    }

    websiteUrl = org.website_url
    auditOrganizationId = organizationId
  } else {
    // No URL and no organizationId provided
    return NextResponse.json(
      { error: 'Either URL or organization ID must be provided' },
      { status: 400 }
    )
  }

  // Create audit record
  const { data: audit, error } = await supabase
    .from('site_audits')
    .insert({
      organization_id: auditOrganizationId,
      url: websiteUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Audit API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start first batch in background using Next.js after() to ensure completion
  // This tells Vercel to keep the function running after the response is sent
  after(async () => {
    try {
      await runAuditBatch(audit.id, websiteUrl)
    } catch (err) {
      console.error('[Audit API] Background audit batch failed:', err)
    }
  })

  return NextResponse.json({ auditId: audit.id })
}
