'use client'

import { ProfileForm } from '@/components/settings/profile-form'
import { showSuccess } from '@/components/ui/sonner'

interface ProfilePageFormProps {
  email: string
  firstName: string
  lastName: string
  role: string
}

export function ProfilePageForm({ email, firstName, lastName, role }: ProfilePageFormProps) {
  return (
    <ProfileForm
      email={email}
      firstName={firstName}
      lastName={lastName}
      role={role}
      onSuccess={() => {
        showSuccess('Profile updated successfully!')
      }}
    />
  )
}
