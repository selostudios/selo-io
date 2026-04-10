import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/navigation
const mockSearchParams = new Map<string, string>()
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}))

// Mock server actions
vi.mock('@/app/login/actions', () => ({
  signInWithEmail: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUpWithInvite: vi.fn(),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: { alt: string; [key: string]: unknown }) => {
    const { alt, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...rest} />
  },
}))

import { LoginForm } from '@/components/auth/login-form'

describe('LoginForm', () => {
  test('renders sign-in form by default', () => {
    mockSearchParams.clear()
    render(<LoginForm />)

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  test('renders sign-up form when mode=signup and invite redirect present', () => {
    mockSearchParams.clear()
    mockSearchParams.set('mode', 'signup')
    mockSearchParams.set('redirect', '/accept-invite/invite-123')
    render(<LoginForm />)

    expect(screen.getByText('Create your account to accept the invitation')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
  })

  test('does not show sign-up mode without invite redirect', () => {
    mockSearchParams.clear()
    mockSearchParams.set('mode', 'signup')
    // No redirect param
    render(<LoginForm />)

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument()
  })

  test('shows toggle link to sign in when in sign-up mode', () => {
    mockSearchParams.clear()
    mockSearchParams.set('mode', 'signup')
    mockSearchParams.set('redirect', '/accept-invite/invite-123')
    render(<LoginForm />)

    expect(screen.getByText('Already have an account?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  test('shows toggle link to create account when in sign-in mode with invite', () => {
    mockSearchParams.clear()
    mockSearchParams.set('redirect', '/accept-invite/invite-123')
    render(<LoginForm />)

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create one' })).toBeInTheDocument()
  })

  test('does not show toggle links without invite redirect', () => {
    mockSearchParams.clear()
    render(<LoginForm />)

    expect(screen.queryByText("Don't have an account?")).not.toBeInTheDocument()
    expect(screen.queryByText('Already have an account?')).not.toBeInTheDocument()
  })

  test('shows Google OAuth button', () => {
    mockSearchParams.clear()
    render(<LoginForm />)

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  test('shows password hint in sign-up mode', () => {
    mockSearchParams.clear()
    mockSearchParams.set('mode', 'signup')
    mockSearchParams.set('redirect', '/accept-invite/invite-123')
    render(<LoginForm />)

    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument()
  })
})
