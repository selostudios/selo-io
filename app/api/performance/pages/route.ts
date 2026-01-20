import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List monitored pages
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: pages, error: pagesError } = await supabase
    .from('monitored_pages')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  if (pagesError) {
    console.error('[Monitored Pages Error]', {
      type: 'list_error',
      timestamp: new Date().toISOString(),
      error: pagesError.message,
    })
    return NextResponse.json({ error: 'Failed to list pages' }, { status: 500 })
  }

  return NextResponse.json(pages || [])
}

// POST - Add monitored page
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { url } = body as { url?: string }

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: page, error } = await supabase
    .from('monitored_pages')
    .insert({
      organization_id: userRecord.organization_id,
      url,
      added_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Page already monitored' }, { status: 409 })
    }
    console.error('[Monitored Pages Error]', {
      type: 'insert_error',
      timestamp: new Date().toISOString(),
      error,
    })
    return NextResponse.json({ error: 'Failed to add page' }, { status: 500 })
  }

  return NextResponse.json(page)
}

// DELETE - Remove monitored page
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Add user organization lookup
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (userError || !userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Page ID is required' }, { status: 400 })
  }

  // Add organization_id check to prevent IDOR
  const { error } = await supabase
    .from('monitored_pages')
    .delete()
    .eq('id', id)
    .eq('organization_id', userRecord.organization_id)

  if (error) {
    console.error('[Monitored Pages Error]', {
      type: 'delete_error',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return NextResponse.json({ error: 'Failed to remove page' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
