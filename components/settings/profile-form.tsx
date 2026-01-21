'use client'

import { useState } from 'react'
import { updateProfile } from '@/app/profile/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

interface ProfileFormProps {
  email: string
  firstName: string
  lastName: string
  role?: string
  onUpdate?: (firstName: string, lastName: string) => void
  onSuccess?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  developer: 'Developer',
  team_member: 'Team Member',
  client_viewer: 'Client Viewer',
}

export function ProfileForm({
  email,
  firstName: initialFirstName,
  lastName: initialLastName,
  role,
  onUpdate,
  onSuccess,
}: ProfileFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const router = useRouter()

  // Check if save button should be disabled
  const isFirstNameValid = firstName.trim().length >= 2
  const hasChanges =
    firstName.trim() !== initialFirstName.trim() || lastName.trim() !== initialLastName.trim()
  const isSaveDisabled = !isFirstNameValid || !hasChanges || isLoading

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await updateProfile(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      setIsLoading(false)
      onUpdate?.(firstName.trim(), lastName.trim())
      onSuccess?.()
      router.refresh()
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            placeholder="First name…"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            disabled={isLoading}
          />
          {firstName.trim().length > 0 && firstName.trim().length < 2 && (
            <p className="text-xs text-red-600">At least 2 characters</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            placeholder="Last name…"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          disabled
          className="cursor-not-allowed bg-neutral-50"
        />
        <p className="text-muted-foreground text-xs">Email cannot be changed</p>
      </div>
      {role && (
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            name="role"
            type="text"
            value={ROLE_LABELS[role] || role}
            disabled
            className="cursor-not-allowed bg-neutral-50"
          />
        </div>
      )}
      {error && (
        <div role="alert" aria-live="polite" className="rounded bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaveDisabled}>
          {isLoading ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
