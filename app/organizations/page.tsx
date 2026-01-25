import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationsClient } from './client'

export default async function OrganizationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all organizations with counts
  const { data: organizations } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      website_url,
      status,
      industry,
      contact_email,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false })

  return <OrganizationsClient organizations={organizations || []} />
}
