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

  // Get all organizations
  const { data: organizations } = await supabase
    .from('organizations')
    .select(
      `
      id,
      name,
      website_url,
      status,
      industry,
      contact_email,
      created_at,
      updated_at
    `
    )
    .order('created_at', { ascending: false })

  // Fetch industries for the edit dialog
  const { data: industries } = await supabase
    .from('industries')
    .select('id, name')
    .order('name', { ascending: true })

  return <OrganizationsClient organizations={organizations || []} industries={industries || []} />
}
