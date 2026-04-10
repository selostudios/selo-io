import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  const { researchId } = await params

  try {
    const results = await getResearchResults(researchId)
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
