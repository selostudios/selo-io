'use client'

import { useState } from 'react'
import { sendInvite } from '@/app/(authenticated)/settings/team/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function InviteUserForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [role, setRole] = useState('client_viewer')

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setWarning(null)

    formData.append('role', role)

    const result = await sendInvite(formData)

    if (result?.error) {
      setError(result.error)
    } else if (result?.warning) {
      setWarning(result.warning)
      // Reset form - invite was still created
      const form = document.querySelector('form') as HTMLFormElement
      form?.reset()
    } else if (result?.success) {
      setSuccess(result.message || 'Invite sent successfully!')
      // Reset form
      const form = document.querySelector('form') as HTMLFormElement
      form?.reset()
    }

    setIsLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Team Member</CardTitle>
        <CardDescription>Send an invitation to join your organization</CardDescription>
      </CardHeader>
      <CardContent>
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
            <Select value={role} onValueChange={setRole} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="team_member">Team Member</SelectItem>
                <SelectItem value="client_viewer">Client Viewer</SelectItem>
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
          {warning && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded bg-amber-50 p-3 text-sm break-all text-amber-700"
            >
              {warning}
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
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send Invite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
