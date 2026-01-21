import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Dismiss a check (flag as invalid)
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const body = await request.json()
  const { check_name, url } = body

  if (!check_name || !url) {
    return NextResponse.json({ error: 'check_name and url are required' }, { status: 400 })
  }

  // Insert dismissed check (upsert to handle duplicates)
  const { data, error } = await supabase
    .from('dismissed_checks')
    .upsert(
      {
        organization_id: userData.organization_id,
        check_name,
        url,
        dismissed_by: user.id,
      },
      {
        onConflict: 'organization_id,check_name,url',
      }
    )
    .select()
    .single()

  if (error) {
    console.error('[Dismiss Check Error]', {
      type: 'dismiss_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to dismiss check' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE - Restore a dismissed check
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('dismissed_checks')
    .delete()
    .eq('id', id)
    .eq('organization_id', userData.organization_id)

  if (error) {
    console.error('[Restore Check Error]', {
      type: 'restore_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to restore check' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// GET - List all dismissed checks for the organization
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dismissed_checks')
    .select('*')
    .eq('organization_id', userData.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[List Dismissed Checks Error]', {
      type: 'list_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to list dismissed checks' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
