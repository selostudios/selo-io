import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAudit } from '@/lib/audit/runner'

// Extend function timeout for long-running audits (max 300s on Pro plan)
export const maxDuration = 300

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
  const { projectId } = body as { projectId?: string }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let websiteUrl: string

  // If projectId is provided, get URL from project
  if (projectId) {
    const { data: project } = await supabase
      .from('seo_projects')
      .select('url')
      .eq('id', projectId)
      .eq('organization_id', userRecord.organization_id)
      .single()

    if (!project?.url) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    websiteUrl = project.url
  } else {
    // Fallback to organization's website URL for backward compatibility
    const { data: org } = await supabase
      .from('organizations')
      .select('website_url')
      .eq('id', userRecord.organization_id)
      .single()

    if (!org?.website_url) {
      return NextResponse.json({ error: 'No website URL configured' }, { status: 400 })
    }
    websiteUrl = org.website_url
  }

  // Create audit record
  const { data: audit, error } = await supabase
    .from('site_audits')
    .insert({
      organization_id: userRecord.organization_id,
      project_id: projectId || null,
      url: websiteUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Audit API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start crawl in background using Next.js after() to ensure completion
  // This tells Vercel to keep the function running after the response is sent
  after(async () => {
    try {
      await runAudit(audit.id, websiteUrl)
    } catch (err) {
      console.error('[Audit API] Background audit failed:', err)
    }
  })

  return NextResponse.json({ auditId: audit.id })
}
