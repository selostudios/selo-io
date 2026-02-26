import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationsClient } from './client'
import { OrganizationStatus } from '@/lib/enums'

const STATUS_SORT_ORDER: Record<string, number> = {
  [OrganizationStatus.Customer]: 0,
  [OrganizationStatus.Prospect]: 1,
  [OrganizationStatus.Inactive]: 2,
}

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
      logo_url,
      created_at,
      updated_at
    `
    )
    .order('name', { ascending: true })

  // Sort: customers first, then prospects, then inactive — alphabetical within each group
  const sortedOrganizations = (organizations || []).sort((a, b) => {
    const statusDiff = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99)
    if (statusDiff !== 0) return statusDiff
    return a.name.localeCompare(b.name)
  })

  // Fetch industries for the edit dialog
  const { data: industries } = await supabase
    .from('industries')
    .select('id, name')
    .order('name', { ascending: true })

  return <OrganizationsClient organizations={sortedOrganizations} industries={industries || []} />
}
