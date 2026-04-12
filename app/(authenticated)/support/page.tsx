import { createClient } from '@/lib/supabase/server'
import { canManageFeedback, isInternalUser } from '@/lib/permissions'
import { SupportPageClient } from './page-client'

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user role and internal status for permission check
  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(role)')
    .eq('id', user!.id)
    .single()

  const userRole = (rawUser?.team_members as { role: string }[])?.[0]?.role ?? 'client_viewer'
  const canEdit = (rawUser && isInternalUser(rawUser)) || canManageFeedback(userRole)

  // Fetch all feedback with relations
  // Note: email is in auth.users, not public.users - would need a view or function to access
  const { data: feedback, error } = await supabase
    .from('feedback')
    .select(
      `
      *,
      submitter:users!submitted_by(id, first_name, last_name),
      organization:organizations(id, name)
    `
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Support Page Error]', {
      type: 'fetch_error',
      error,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <SupportPageClient feedback={feedback || []} initialIssueId={params.issue} canEdit={canEdit} />
  )
}
