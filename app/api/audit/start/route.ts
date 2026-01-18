import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAudit } from '@/lib/audit/runner'

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  // Get organization's website URL
  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  if (!org?.website_url) {
    return NextResponse.json({ error: 'No website URL configured' }, { status: 400 })
  }

  // Create audit record
  const { data: audit, error } = await supabase
    .from('site_audits')
    .insert({
      organization_id: userRecord.organization_id,
      url: org.website_url,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Audit API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  // Start crawl in background (don't await)
  runAudit(audit.id, org.website_url).catch((err) => {
    console.error('[Audit API] Background audit failed:', err)
  })

  return NextResponse.json({ auditId: audit.id })
}
