'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SeoProject {
  id: string
  organization_id: string
  name: string
  url: string
  created_at: string
  updated_at: string
}

export async function getProjects(): Promise<SeoProject[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return []
  }

  const { data: projects, error } = await supabase
    .from('seo_projects')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[SEO Projects Error]', {
      type: 'fetch_projects_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return []
  }

  return projects ?? []
}

export async function createProject(
  name: string,
  url: string
): Promise<{ success: boolean; project?: SeoProject; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { success: false, error: 'User not found' }
  }

  // Validate URL
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, error: 'URL must use http or https protocol' }
    }
  } catch {
    return { success: false, error: 'Invalid URL format' }
  }

  const { data: project, error } = await supabase
    .from('seo_projects')
    .insert({
      organization_id: userRecord.organization_id,
      name: name.trim(),
      url: url.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('[SEO Projects Error]', {
      type: 'create_project_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to create project' }
  }

  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true, project }
}

export async function updateProject(
  id: string,
  name: string,
  url: string
): Promise<{ success: boolean; project?: SeoProject; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate URL
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, error: 'URL must use http or https protocol' }
    }
  } catch {
    return { success: false, error: 'Invalid URL format' }
  }

  const { data: project, error } = await supabase
    .from('seo_projects')
    .update({
      name: name.trim(),
      url: url.trim(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[SEO Projects Error]', {
      type: 'update_project_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to update project' }
  }

  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true, project }
}

export async function deleteProject(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase.from('seo_projects').delete().eq('id', id)

  if (error) {
    console.error('[SEO Projects Error]', {
      type: 'delete_project_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to delete project' }
  }

  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')

  return { success: true }
}
