'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signInWithEmail(formData: FormData): Promise<{ error: string } | undefined> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Add validation
  if (!email || !password) {
    return { error: 'Email and password are required' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email format' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Generic error message to prevent account enumeration
    console.error('[Auth Error]', { type: 'email_signin', timestamp: new Date().toISOString() })
    return { error: 'Invalid email or password' }
  }

  redirect('/dashboard')
}

export async function signInWithOAuth(
  provider: 'google' | 'azure'
): Promise<{ error: string } | undefined> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    console.error('[Auth Error]', { type: 'oauth_config', timestamp: new Date().toISOString() })
    return { error: 'Server configuration error. Please contact support.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    // Generic error message to prevent information disclosure
    console.error('[Auth Error]', {
      type: 'oauth_signin',
      provider,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to initiate sign-in. Please try again.' }
  }

  if (data.url) {
    redirect(data.url)
  }

  // Handle case where OAuth URL isn't generated
  console.error('[Auth Error]', {
    type: 'oauth_no_url',
    provider,
    timestamp: new Date().toISOString(),
  })
  return { error: 'Failed to initiate sign-in. Please try again.' }
}
