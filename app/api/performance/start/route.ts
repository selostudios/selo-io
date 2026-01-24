import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPerformanceAudit } from '@/lib/performance/runner'

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
  const { urls, projectId } = body as { urls?: string[]; projectId?: string }

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

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // If projectId is provided, verify it belongs to user's organization
  if (projectId) {
    const { data: project } = await supabase
      .from('seo_projects')
      .select('id')
      .eq('id', projectId)
      .eq('organization_id', userRecord.organization_id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  // Create audit record
  const { data: audit, error } = await supabase
    .from('performance_audits')
    .insert({
      organization_id: userRecord.organization_id,
      project_id: projectId || null,
      created_by: user.id,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Performance API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start audit in background
  runPerformanceAudit(audit.id, urls).catch((err) => {
    console.error('[Performance API] Background audit failed:', err)
  })

  return NextResponse.json({ auditId: audit.id })
}
