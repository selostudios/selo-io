'use client'

import { useState } from 'react'
import { updateProfile } from '@/app/dashboard/settings/profile/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

interface ProfileFormProps {
  email: string
  name: string
}

export function ProfileForm({ email, name: initialName }: ProfileFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState(initialName)
  const router = useRouter()

  // Check if save button should be disabled
  const isNameValid = name.trim().length >= 3
  const hasChanges = name.trim() !== initialName.trim()
  const isSaveDisabled = !isNameValid || !hasChanges || isLoading

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const result = await updateProfile(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      setSuccess('Profile updated successfully!')
      setIsLoading(false)
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
            {name.trim().length > 0 && name.trim().length < 3 && (
              <p className="text-xs text-red-600">
                Name must be at least 3 characters
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              disabled
              className="bg-neutral-50 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
              {success}
            </div>
          )}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaveDisabled}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
