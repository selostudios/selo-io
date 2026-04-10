import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInternalUser } from '@/lib/permissions'
import { getResearchResults } from '@/lib/ai-visibility/research'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ researchId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get user's org for authorization
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

  const { researchId } = await params

  try {
    const results = await getResearchResults(researchId)

    // Verify user has access — check org of results, or verify user's org
    if (!isInternalUser(userRecord)) {
      // Check if any result belongs to a different org
      const foreignResult = results.find((r) => r.organization_id !== userRecord.organization_id)
      if (foreignResult) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      // If no results yet, the researchId is a 128-bit UUID — unguessable.
      // The start endpoint already verified org access before generating it.
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('[Research Results Error]', {
      type: 'results_fetch_failed',
      researchId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
  }
}
