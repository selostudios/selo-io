import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInternalUser } from '@/lib/permissions'
import { prepareResearch, executeResearch } from '@/lib/ai-visibility/research'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const { orgId, promptText, websiteUrl, orgName, competitors } = body as {
    orgId?: string
    promptText?: string
    websiteUrl?: string | null
    orgName?: string
    competitors?: { name: string; domain: string }[]
  }

  if (!orgId || !promptText?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify user has access to the organization
  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id)')
    .eq('id', user.id)
    .single()

  const userRecord = rawUser
    ? {
        organization_id:
          (rawUser.team_members as { organization_id: string }[])?.[0]?.organization_id ?? null,
        is_internal: rawUser.is_internal,
      }
    : null

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!isInternalUser(userRecord) && orgId !== userRecord.organization_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const result = await prepareResearch(orgId)

    // Fire queries in background
    after(async () => {
      try {
        await executeResearch(
          orgId,
          result.researchId,
          promptText,
          result.platforms,
          websiteUrl ?? null,
          orgName ?? '',
          competitors ?? []
        )
      } catch (error) {
        console.error('[Research Execute Error]', {
          type: 'background_execution_failed',
          orgId,
          researchId: result.researchId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Research Start Error]', {
      type: 'research_start_failed',
      orgId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start research' },
      { status: 500 }
    )
  }
}
