'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signInWithEmail, signInWithOAuth } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Simple email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const isFormValid = isValidEmail(email) && password.length > 0

  async function handleEmailSignIn(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await signInWithEmail(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
      setPassword('') // Clear password on error
      // Keep email value
    }
  }

  async function handleOAuthSignIn(provider: 'google' | 'azure') {
    setIsLoading(true)
    setError(null)

    const result = await signInWithOAuth(provider)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

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
        <CardDescription className="text-center">Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={handleEmailSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

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
