import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization via team_members - don't trust client-provided organization_id
  const { data: rawUser } = await supabase
    .from('users')
    .select('id, team_members(organization_id)')
    .eq('id', user.id)
    .single()

  const userRecord = rawUser
    ? {
        organization_id:
          (rawUser.team_members as { organization_id: string }[])?.[0]?.organization_id ?? null,
      }
    : null

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { url } = body as { url?: string }

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('monitored_sites')
    .insert({ url, organization_id: userRecord.organization_id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Site already monitored' }, { status: 409 })
    }
    console.error('[Monitored Sites Error]', {
      type: 'insert_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization via team_members
  const { data: rawPatchUser } = await supabase
    .from('users')
    .select('id, team_members(organization_id)')
    .eq('id', user.id)
    .single()

  const userRecord = rawPatchUser
    ? {
        organization_id:
          (rawPatchUser.team_members as { organization_id: string }[])?.[0]?.organization_id ??
          null,
      }
    : null

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { id, run_site_audit, run_performance_audit } = body as {
    id?: string
    run_site_audit?: boolean
    run_performance_audit?: boolean
  }

  if (!id) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
  }

  // Build update object with only allowed fields
  const updates: { run_site_audit?: boolean; run_performance_audit?: boolean } = {}
  if (run_site_audit !== undefined) updates.run_site_audit = run_site_audit
  if (run_performance_audit !== undefined) updates.run_performance_audit = run_performance_audit

  // Update with organization check to prevent IDOR
  const { error } = await supabase
    .from('monitored_sites')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', userRecord.organization_id)

  if (error) {
    console.error('[Monitored Sites Error]', {
      type: 'update_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization via team_members
  const { data: rawDeleteUser } = await supabase
    .from('users')
    .select('id, team_members(organization_id)')
    .eq('id', user.id)
    .single()

  const deleteUserRecord = rawDeleteUser
    ? {
        organization_id:
          (rawDeleteUser.team_members as { organization_id: string }[])?.[0]?.organization_id ??
          null,
      }
    : null

  if (!deleteUserRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
  }

  // Delete with organization check to prevent IDOR
  const { error } = await supabase
    .from('monitored_sites')
    .delete()
    .eq('id', id)
    .eq('organization_id', deleteUserRecord.organization_id)

  if (error) {
    console.error('[Monitored Sites Error]', {
      type: 'delete_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
