'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sendInvite } from '@/app/(authenticated)/settings/team/actions'
import { useRouter } from 'next/navigation'
import { UserRole } from '@/lib/enums'

interface InviteUserDialogProps {
  organizationId: string
}

export function InviteUserDialog({ organizationId }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState<UserRole>(UserRole.ClientViewer)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    formData.append('role', role)
    formData.append('organizationId', organizationId)

    const result = await sendInvite(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      setSuccess(result.message || 'Invite sent successfully!')
      setIsLoading(false)
      // Close dialog after a brief delay to show success message
      setTimeout(() => {
        setOpen(false)
        setSuccess(null)
        setRole(UserRole.ClientViewer)
        router.refresh()
      }, 1500)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>Send an invitation to join your organization</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="colleague@example.com…"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(role) => setRole(role as UserRole)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.Admin}>Admin</SelectItem>
                <SelectItem value={UserRole.TeamMember}>Team Member</SelectItem>
                <SelectItem value={UserRole.ClientViewer}>Client Viewer</SelectItem>
                <SelectItem value={UserRole.ExternalDeveloper}>External Developer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded bg-red-50 p-3 text-sm text-red-600"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              aria-live="polite"
              className="rounded bg-green-50 p-3 text-sm break-all text-green-600"
            >
              {success}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send Invite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
