'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get('name') as string

  if (!name || name.trim().length === 0) {
    return { error: 'Name is required' }
  }

  if (name.length > 100) {
    return { error: 'Name must be less than 100 characters' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Update user name
  const { error } = await supabase
    .from('users')
    .update({ name: name.trim() })
    .eq('id', user.id)

  if (error) {
    console.error('[Profile Error]', { type: 'update_name', error, timestamp: new Date().toISOString() })
    return { error: 'Failed to update profile' }
  }

  revalidatePath('/dashboard/settings/profile')
  revalidatePath('/dashboard/settings/team')

  return { success: true }
}
