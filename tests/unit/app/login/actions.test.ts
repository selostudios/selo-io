import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing
const mockCreateClient = vi.fn()
const mockCreateServiceClient = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  createServiceClient: () => mockCreateServiceClient(),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error(`REDIRECT:${url}`)
  },
}))

import { signUpWithInvite } from '@/app/login/actions'

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

describe('signUpWithInvite', () => {
  const validInviteId = 'invite-123'
  const validEmail = 'user@example.com'
  const validPassword = 'securepassword'

  let serviceClient: {
    from: ReturnType<typeof vi.fn>
    auth: { admin: { createUser: ReturnType<typeof vi.fn>; deleteUser: ReturnType<typeof vi.fn> } }
  }
  let userClient: {
    auth: { signInWithPassword: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    serviceClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validInviteId,
                  email: validEmail,
                  status: 'pending',
                  expires_at: new Date(Date.now() + 86400000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-user-id' } },
            error: null,
          }),
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    }

    userClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    }

    mockCreateServiceClient.mockReturnValue(serviceClient)
    mockCreateClient.mockResolvedValue(userClient)
  })

  test('rejects when fields are missing', async () => {
    const result = await signUpWithInvite(
      makeFormData({ email: validEmail, password: '', confirmPassword: '' }),
      validInviteId
    )
    expect(result).toEqual({ error: 'All fields are required' })
  })

  test('rejects invalid email format', async () => {
    const result = await signUpWithInvite(
      makeFormData({ email: 'bad', password: validPassword, confirmPassword: validPassword }),
      validInviteId
    )
    expect(result).toEqual({ error: 'Invalid email format' })
  })

  test('rejects password shorter than 8 characters', async () => {
    const result = await signUpWithInvite(
      makeFormData({ email: validEmail, password: 'short', confirmPassword: 'short' }),
      validInviteId
    )
    expect(result).toEqual({ error: 'Password must be at least 8 characters' })
  })

  test('rejects mismatched passwords', async () => {
    const result = await signUpWithInvite(
      makeFormData({
        email: validEmail,
        password: validPassword,
        confirmPassword: 'differentpassword',
      }),
      validInviteId
    )
    expect(result).toEqual({ error: 'Passwords do not match' })
  })

  test('rejects when invite is not found', async () => {
    serviceClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      }),
    })

    const result = await signUpWithInvite(
      makeFormData({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
      }),
      validInviteId
    )
    expect(result).toEqual({ error: 'Invalid or expired invitation' })
  })

  test('rejects when email does not match invite', async () => {
    const result = await signUpWithInvite(
      makeFormData({
        email: 'wrong@example.com',
        password: validPassword,
        confirmPassword: validPassword,
      }),
      validInviteId
    )
    expect(result).toEqual({ error: 'Email does not match the invitation' })
  })

  test('rejects expired invite', async () => {
    serviceClient.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: validInviteId,
                email: validEmail,
                status: 'pending',
                expires_at: new Date(Date.now() - 86400000).toISOString(), // expired
              },
              error: null,
            }),
          }),
        }),
      }),
    })

    const result = await signUpWithInvite(
      makeFormData({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
      }),
      validInviteId
    )
    expect(result).toEqual({ error: 'This invitation has expired' })
  })

  test('redirects to accept-invite on success', async () => {
    await expect(
      signUpWithInvite(
        makeFormData({
          email: validEmail,
          password: validPassword,
          confirmPassword: validPassword,
        }),
        validInviteId
      )
    ).rejects.toThrow(`REDIRECT:/accept-invite/${validInviteId}`)

    expect(serviceClient.auth.admin.createUser).toHaveBeenCalledWith({
      email: validEmail,
      password: validPassword,
      email_confirm: true,
    })
  })

  test('cleans up auth user when users table insert fails', async () => {
    // Make the users insert fail
    let callCount = 0
    serviceClient.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return { insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }) }
      }
      // First call is for invites
      callCount++
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: validInviteId,
                    email: validEmail,
                    status: 'pending',
                    expires_at: new Date(Date.now() + 86400000).toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }) }
    })

    const result = await signUpWithInvite(
      makeFormData({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
      }),
      validInviteId
    )

    expect(result).toEqual({ error: 'Failed to create account. Please try again.' })
    expect(serviceClient.auth.admin.deleteUser).toHaveBeenCalledWith('new-user-id')
  })
})
