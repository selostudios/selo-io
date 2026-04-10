'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InviteStatus } from '@/lib/enums'
import { sanitizeRedirectPath } from '@/lib/security/redirect'
import { loginLimiter, signupLimiter, getIpFromHeaders } from '@/lib/rate-limit'

export async function signInWithEmail(
  formData: FormData,
  redirectTo?: string
): Promise<{ error: string } | undefined> {
  const ip = await getIpFromHeaders()
  const limit = loginLimiter.check(ip)
  if (!limit.success) {
    return { error: 'Too many sign-in attempts. Please try again later.' }
  }

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

  redirect(sanitizeRedirectPath(redirectTo))
}

export async function signInWithOAuth(
  provider: 'google' | 'azure',
  redirectTo?: string
): Promise<{ error: string } | undefined> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    console.error('[Auth Error]', { type: 'oauth_config', timestamp: new Date().toISOString() })
    return { error: 'Server configuration error. Please contact support.' }
  }

  // Pass the redirect path through to the auth callback via the `next` query param
  const callbackUrl = new URL(`${siteUrl}/auth/callback`)
  const safeRedirect = sanitizeRedirectPath(redirectTo, '')
  if (safeRedirect) {
    callbackUrl.searchParams.set('next', safeRedirect)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
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

export async function signUpWithInvite(
  formData: FormData,
  inviteId: string
): Promise<{ error: string } | undefined> {
  const ip = await getIpFromHeaders()
  const limit = signupLimiter.check(ip)
  if (!limit.success) {
    return { error: 'Too many sign-up attempts. Please try again later.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!email || !password || !confirmPassword) {
    return { error: 'All fields are required' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email format' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  // Validate that a pending invite exists for this email
  const serviceClient = createServiceClient()
  const { data: invite, error: inviteError } = await serviceClient
    .from('invites')
    .select('id, email, status, expires_at')
    .eq('id', inviteId)
    .eq('status', InviteStatus.Pending)
    .single()

  if (inviteError || !invite) {
    return { error: 'Invalid or expired invitation' }
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'This invitation has expired' }
  }

  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    return { error: 'Email does not match the invitation' }
  }

  // Create user via service client with auto-confirm (invite is the verification)
  const { data: authData, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message?.includes('already been registered')) {
      return { error: 'An account with this email already exists. Please sign in instead.' }
    }
    console.error('[Auth Error]', {
      type: 'invite_signup',
      error: createError.message,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to create account. Please try again.' }
  }

  // Create public.users row
  const { error: userRecordError } = await serviceClient.from('users').insert({
    id: authData.user.id,
  })

  if (userRecordError) {
    console.error('[Auth Error]', {
      type: 'invite_signup_user_record',
      error: userRecordError.message,
      timestamp: new Date().toISOString(),
    })
    // Clean up auth user on failure
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return { error: 'Failed to create account. Please try again.' }
  }

  // Sign the user in
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    console.error('[Auth Error]', {
      type: 'invite_signup_signin',
      error: signInError.message,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Account created but sign-in failed. Please sign in manually.' }
  }

  redirect(`/accept-invite/${inviteId}`)
}
