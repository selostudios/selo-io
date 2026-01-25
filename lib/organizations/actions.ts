'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Organization, OrganizationStatus } from './types'

/**
 * Check if the current user is an internal Selo employee
 */
export async function isInternalUser(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  return userRecord?.is_internal === true
}

/**
 * Get current user info including internal status and organization
 */
export async function getCurrentUser(): Promise<{
  id: string
  isInternal: boolean
  organizationId: string | null
} | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('id, is_internal, organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return null
  }

  return {
    id: userRecord.id,
    isInternal: userRecord.is_internal === true,
    organizationId: userRecord.organization_id,
  }
}

/**
 * Get all organizations visible to the current user
 * RLS handles filtering: internal users see all, external users see only their own
 */
export async function getOrganizations(): Promise<Organization[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('[Organizations Error]', {
      type: 'get_organizations',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return []
  }

  return data as Organization[]
}

/**
 * Get a single organization by ID
 */
export async function getOrganization(
  id: string
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'get_organization',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Organization not found' }
  }

  return { success: true, organization: data as Organization }
}

/**
 * Create a new prospect organization (internal users only)
 */
export async function createOrganization(
  name: string,
  websiteUrl: string
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  const supabase = await createClient()

  // Verify user is internal
  const currentUser = await getCurrentUser()
  if (!currentUser?.isInternal) {
    return { success: false, error: 'Only internal users can create organizations' }
  }

  // Validate name
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Organization name is required' }
  }

  if (name.length > 100) {
    return { success: false, error: 'Organization name must be less than 100 characters' }
  }

  // Validate website URL
  if (!websiteUrl || websiteUrl.trim().length === 0) {
    return { success: false, error: 'Website URL is required' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(websiteUrl.trim())
    if (parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Website URL must start with https://' }
    }
    if (!parsedUrl.hostname.includes('.')) {
      return { success: false, error: 'Please enter a valid domain (e.g., example.com)' }
    }
  } catch {
    return { success: false, error: 'Website URL must be a valid URL (e.g., https://example.com)' }
  }

  // Create organization with prospect status
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: name.trim(),
      website_url: websiteUrl.trim(),
      status: 'prospect' as OrganizationStatus,
    })
    .select()
    .single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'create_organization',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to create organization' }
  }

  revalidatePath('/seo')
  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true, organization: data as Organization }
}

/**
 * Convert a prospect organization to a customer (internal users only)
 */
export async function convertToCustomer(
  organizationId: string,
  industry: string,
  contactEmail: string
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  const supabase = await createClient()

  // Verify user is internal
  const currentUser = await getCurrentUser()
  if (!currentUser?.isInternal) {
    return { success: false, error: 'Only internal users can convert organizations' }
  }

  // Validate organizationId
  if (!organizationId) {
    return { success: false, error: 'Organization ID is required' }
  }

  // Validate industry
  if (!industry || industry.trim().length === 0) {
    return { success: false, error: 'Industry is required' }
  }

  // Validate contact email
  if (!contactEmail || contactEmail.trim().length === 0) {
    return { success: false, error: 'Contact email is required' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(contactEmail)) {
    return { success: false, error: 'Invalid email address format' }
  }

  // Update organization
  const { data, error } = await supabase
    .from('organizations')
    .update({
      status: 'customer' as OrganizationStatus,
      industry: industry.trim(),
      contact_email: contactEmail.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select()
    .single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'convert_to_customer',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to convert organization to customer' }
  }

  revalidatePath('/seo')
  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true, organization: data as Organization }
}

/**
 * Update organization status (internal users only)
 */
export async function updateOrganizationStatus(
  organizationId: string,
  status: OrganizationStatus
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  const supabase = await createClient()

  // Verify user is internal
  const currentUser = await getCurrentUser()
  if (!currentUser?.isInternal) {
    return { success: false, error: 'Only internal users can update organization status' }
  }

  // Validate organizationId
  if (!organizationId) {
    return { success: false, error: 'Organization ID is required' }
  }

  // Validate status
  const validStatuses: OrganizationStatus[] = ['prospect', 'customer', 'inactive']
  if (!validStatuses.includes(status)) {
    return { success: false, error: 'Invalid status value' }
  }

  // Update organization status
  const { data, error } = await supabase
    .from('organizations')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select()
    .single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'update_organization_status',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to update organization status' }
  }

  revalidatePath('/seo')
  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true, organization: data as Organization }
}

/**
 * Update organization details (internal users only)
 */
export async function updateOrganization(
  organizationId: string,
  updates: {
    name: string
    website_url: string | null
    status: OrganizationStatus
    contact_email: string | null
    industry: string | null
  }
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  const supabase = await createClient()

  // Verify user is internal
  const currentUser = await getCurrentUser()
  if (!currentUser?.isInternal) {
    return { success: false, error: 'Only internal users can update organizations' }
  }

  // Validate organizationId
  if (!organizationId) {
    return { success: false, error: 'Organization ID is required' }
  }

  // Validate name
  if (!updates.name || updates.name.trim().length === 0) {
    return { success: false, error: 'Organization name is required' }
  }

  if (updates.name.length > 100) {
    return { success: false, error: 'Organization name must be less than 100 characters' }
  }

  // Validate status
  const validStatuses: OrganizationStatus[] = ['prospect', 'customer', 'inactive']
  if (!validStatuses.includes(updates.status)) {
    return { success: false, error: 'Invalid status value' }
  }

  // Validate contact email if provided
  if (updates.contact_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(updates.contact_email)) {
      return { success: false, error: 'Invalid email address format' }
    }
  }

  // Update organization
  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: updates.name.trim(),
      website_url: updates.website_url?.trim() || null,
      status: updates.status,
      contact_email: updates.contact_email?.trim().toLowerCase() || null,
      industry: updates.industry?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select()
    .single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'update_organization',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to update organization' }
  }

  revalidatePath('/organizations')
  revalidatePath('/seo')
  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true, organization: data as Organization }
}

/**
 * Archive an organization (soft delete - sets status to inactive)
 * Preserves data for billing and audit purposes
 */
export async function archiveOrganization(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify user is internal
  const currentUser = await getCurrentUser()
  if (!currentUser?.isInternal) {
    return { success: false, error: 'Only internal users can archive organizations' }
  }

  // Validate organizationId
  if (!organizationId) {
    return { success: false, error: 'Organization ID is required' }
  }

  // Archive by setting status to inactive
  const { error } = await supabase
    .from('organizations')
    .update({
      status: 'inactive' as OrganizationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)

  if (error) {
    console.error('[Organizations Error]', {
      type: 'archive_organization',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to archive organization' }
  }

  revalidatePath('/organizations')
  revalidatePath('/seo')
  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true }
}

/**
 * Restore an archived organization (sets status back to prospect)
 */
export async function restoreOrganization(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Verify user is internal
  const currentUser = await getCurrentUser()
  if (!currentUser?.isInternal) {
    return { success: false, error: 'Only internal users can restore organizations' }
  }

  // Validate organizationId
  if (!organizationId) {
    return { success: false, error: 'Organization ID is required' }
  }

  // Restore by setting status to prospect
  const { error } = await supabase
    .from('organizations')
    .update({
      status: 'prospect' as OrganizationStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)

  if (error) {
    console.error('[Organizations Error]', {
      type: 'restore_organization',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to restore organization' }
  }

  revalidatePath('/organizations')
  revalidatePath('/seo')
  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true }
}
