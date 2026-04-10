import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prepareResearch, executeResearch } from '@/lib/ai-visibility/research'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { orgId, promptText, websiteUrl, orgName, competitors } = body

  if (!orgId || !promptText?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const result = await prepareResearch(orgId)

    // Fire queries in background
    after(async () => {
      await executeResearch(
        orgId,
        result.researchId,
        promptText,
        result.platforms,
        websiteUrl,
        orgName,
        competitors ?? []
      )
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
