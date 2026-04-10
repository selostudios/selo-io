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

  const results = await getResearchResults(researchId)

  return NextResponse.json(results)
}
