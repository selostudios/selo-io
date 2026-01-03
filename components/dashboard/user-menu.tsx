'use client'

import { useState } from 'react'
import Link from 'next/link'
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

interface UserMenuProps {
  userEmail: string
  firstName: string
  lastName: string
  initials: string
}

export function UserMenu({ userEmail, firstName, lastName, initials }: UserMenuProps) {
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings/team">Settings</Link>
          </DropdownMenuItem>
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
            <DialogDescription>
              Update your personal information
            </DialogDescription>
          </DialogHeader>
          <ProfileForm email={userEmail} firstName={firstName} lastName={lastName} />
        </DialogContent>
      </Dialog>
    </>
  )
}
