'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ProfileForm } from '@/components/settings/profile-form'
import { useFeedback } from '@/components/feedback/feedback-provider'
import { showSuccess } from '@/components/ui/sonner'

interface UserMenuProps {
  userEmail: string
  firstName: string
  lastName: string
  role: string
}

export function UserMenu({ userEmail, firstName, lastName, role }: UserMenuProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [currentFirstName, setCurrentFirstName] = useState(firstName)
  const [currentLastName, setCurrentLastName] = useState(lastName)
  const { openFeedback } = useFeedback()

  // Compute initials from current name state
  const initials = currentLastName
    ? `${currentFirstName.charAt(0)}${currentLastName.charAt(0)}`.toUpperCase()
    : currentFirstName.substring(0, 2).toUpperCase()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full"
            aria-label="Open user menu"
            data-testid="user-menu-trigger"
          >
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>Profile</DropdownMenuItem>
          <DropdownMenuItem onSelect={openFeedback}>Report an Issue</DropdownMenuItem>
          <DropdownMenuItem>
            <form action="/auth/sign-out" method="post" className="w-full">
              <button type="submit" className="w-full text-left">
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>Update your personal information</DialogDescription>
          </DialogHeader>
          <ProfileForm
            email={userEmail}
            firstName={currentFirstName}
            lastName={currentLastName}
            role={role}
            onUpdate={(newFirstName, newLastName) => {
              setCurrentFirstName(newFirstName)
              setCurrentLastName(newLastName)
            }}
            onSuccess={() => {
              setProfileOpen(false)
              showSuccess('Profile updated successfully!')
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
