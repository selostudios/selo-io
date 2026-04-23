import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessOrg, isInternalUser } from '@/lib/permissions'
import { runUnifiedAuditBatch } from '@/lib/unified-audit/runner'

// Extend function timeout for long-running audits
export const maxDuration = 800

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  let body: {
    url?: string
    organizationId?: string
    crawlMode?: 'standard' | 'exhaustive'
    maxPages?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const { url, organizationId, crawlMode = 'standard', maxPages = 100 } = body

  // Get user record via team_members
  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id)')
    .eq('id', user.id)
    .single()

  const userRecord = rawUser
    ? {
        memberships: (rawUser.team_members as { organization_id: string }[]) ?? [],
        is_internal: rawUser.is_internal,
      }
    : null

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const isInternal = isInternalUser(userRecord)

  let websiteUrl: string
  let auditOrganizationId: string | null = null

  // Handle three scenarios:
  // 1. URL + organizationId: Use URL, link to org (verify access)
  // 2. URL without organizationId: One-time audit (internal only)
  // 3. organizationId without URL: Get URL from org's website_url
  if (url && organizationId) {
    if (!canAccessOrg(userRecord, organizationId)) {
      return NextResponse.json(
        { error: 'Unauthorized to audit this organization' },
        { status: 403 }
      )
    }
    websiteUrl = url
    auditOrganizationId = organizationId
  } else if (url && !organizationId) {
    if (!isInternal) {
      return NextResponse.json(
        { error: 'Organization ID required for external users' },
        { status: 400 }
      )
    }
    websiteUrl = url
    auditOrganizationId = null
  } else if (organizationId && !url) {
    if (!canAccessOrg(userRecord, organizationId)) {
      return NextResponse.json(
        { error: 'Unauthorized to audit this organization' },
        { status: 403 }
      )
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('website_url')
      .eq('id', organizationId)
      .single()

    if (!org?.website_url) {
      return NextResponse.json(
        { error: 'No website URL configured for organization' },
        { status: 400 }
      )
    }

    websiteUrl = org.website_url
    auditOrganizationId = organizationId
  } else {
    return NextResponse.json(
      { error: 'Either URL or organization ID must be provided' },
      { status: 400 }
    )
  }

  // Validate URL format
  try {
    new URL(websiteUrl)
  } catch {
    return NextResponse.json({ error: `Invalid URL: ${websiteUrl}` }, { status: 400 })
  }

  // Create audit record in unified `audits` table
  const domain = new URL(websiteUrl).hostname.replace(/^www\./, '')
  const { data: audit, error } = await supabase
    .from('audits')
    .insert({
      organization_id: auditOrganizationId,
      url: websiteUrl,
      domain,
      status: 'pending',
      created_by: user.id,
      crawl_mode: crawlMode,
      max_pages: maxPages,
    })
    .select()
    .single()

  if (error) {
    console.error('[Unified Audit API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start audit in background — always use batch runner for timeout-safe self-continuation
  after(async () => {
    try {
      await runUnifiedAuditBatch(audit.id, websiteUrl)
    } catch (err) {
      console.error('[Unified Audit API] Background audit failed:', err)
      const serviceClient = (await import('@/lib/supabase/server')).createServiceClient()
      await serviceClient
        .from('audits')
        .update({ status: 'failed' })
        .eq('id', audit.id)
        .in('status', ['pending', 'crawling', 'checking'])
    }
  })

  return NextResponse.json({ auditId: audit.id })
}
