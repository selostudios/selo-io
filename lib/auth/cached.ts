import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { OrganizationForSelector } from '@/lib/organizations/types'

/**
 * Cached auth user — calls supabase.auth.getUser() once per request.
 * Use this instead of calling getUser() directly in layout/header/page.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * User record shape returned by getUserRecord().
 * Contains all fields needed by layout, header, and page components.
 */
export interface CachedUserRecord {
  id: string
  organization_id: string | null
  role: string
  first_name: string | null
  last_name: string | null
  is_internal: boolean | null
  organization: {
    id: string
    name: string
    logo_url: string | null
    website_url: string | null
    status: string
  } | null
}

/**
 * Cached user record — queries users table once per request.
 * Includes org join so layout, header, and page all share the same data.
 */
export const getUserRecord = cache(async (userId: string): Promise<CachedUserRecord | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, organization_id, role, first_name, last_name, is_internal, organization:organizations(id, name, logo_url, website_url, status)'
    )
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as unknown as CachedUserRecord
})

/**
 * Cached organizations list — fetches all non-inactive orgs once per request.
 * Extracted from getOrganizations() server action (which can't be called from RSC).
 */
export const getOrganizationsList = cache(async (): Promise<OrganizationForSelector[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, website_url, status, logo_url')
    .neq('status', 'inactive')
    .order('name', { ascending: true })

  if (error) {
    console.error('[Auth Cache Error]', {
      type: 'get_organizations_list',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return []
  }

  return data as OrganizationForSelector[]
})
