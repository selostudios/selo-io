'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string

  if (!firstName || firstName.trim().length === 0) {
    return { error: 'First name is required' }
  }

  if (firstName.trim().length < 2) {
    return { error: 'First name must be at least 2 characters' }
  }

  if (firstName.length > 50 || lastName.length > 50) {
    return { error: 'Names must be less than 50 characters' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Update user name
  const { error } = await supabase
    .from('users')
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim()
    })
    .eq('id', user.id)

  if (error) {
    console.error('[Profile Error]', { type: 'update_name', error, timestamp: new Date().toISOString() })
    return { error: 'Failed to update profile' }
  }

  revalidatePath('/profile')
  revalidatePath('/settings/team')
  revalidatePath('/dashboard')

  return { success: true }
}
