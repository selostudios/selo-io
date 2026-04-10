'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { signInWithEmail, signInWithOAuth, signUpWithInvite } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

export function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || undefined
  const initialMode = searchParams.get('mode') || 'signin'

  // Extract invite ID from redirect path (e.g. /accept-invite/abc123)
  const inviteId = redirectTo?.match(/^\/accept-invite\/(.+)$/)?.[1] ?? null
  const isInviteFlow = !!inviteId

  const [mode, setMode] = useState<'signin' | 'signup'>(
    initialMode === 'signup' && isInviteFlow ? 'signup' : 'signin'
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const isFormValid =
    mode === 'signup'
      ? isValidEmail(email) && password.length >= 8 && confirmPassword.length > 0
      : isValidEmail(email) && password.length > 0

  async function handleEmailSignIn(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await signInWithEmail(formData, redirectTo)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
      setPassword('')
    }
  }

  async function handleSignUp(formData: FormData) {
    if (!inviteId) return
    setIsLoading(true)
    setError(null)

    const result = await signUpWithInvite(formData, inviteId)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
      setPassword('')
      setConfirmPassword('')
    }
  }

  async function handleOAuthSignIn(provider: 'google' | 'azure') {
    setIsLoading(true)
    setError(null)

    const result = await signInWithOAuth(provider, redirectTo)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  const isSignUp = mode === 'signup'

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <div className="mb-0 flex justify-center">
          <Image
            src="/selo-logo.jpg.webp"
            alt="Selo Studios"
            width={200}
            height={80}
            priority
            className="object-contain"
          />
        </div>
        <CardDescription className="text-center">
          {isSignUp ? 'Create your account to accept the invitation' : 'Sign in to your account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={isSignUp ? handleSignUp : handleEmailSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com…"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            {isSignUp && (
              <p className="text-muted-foreground text-xs">Must be at least 8 characters</p>
            )}
          </div>
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded bg-red-50 p-3 text-sm text-red-600"
            >
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
            {isLoading
              ? isSignUp
                ? 'Creating account…'
                : 'Signing in…'
              : isSignUp
                ? 'Create Account'
                : 'Sign In'}
          </Button>
        </form>

        {isInviteFlow && (
          <p className="text-muted-foreground text-center text-sm">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                    setPassword('')
                    setConfirmPassword('')
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                    setPassword('')
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  Create one
                </button>
              </>
            )}
          </p>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleOAuthSignIn('google')}
          disabled={isLoading}
        >
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  )
}
