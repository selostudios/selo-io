'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { connectPlatform } from '@/app/settings/integrations/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

export function LinkedInConnectDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [organizationId, setOrganizationId] = useState('')
  const [accessToken, setAccessToken] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!organizationId.trim() || !accessToken.trim()) {
      showError('Please fill in all fields')
      return
    }

    setIsLoading(true)

    const formData = new FormData()
    formData.append('platform_type', 'linkedin')
    formData.append(
      'credentials',
      JSON.stringify({
        organization_id: organizationId.trim(),
        access_token: accessToken.trim(),
      })
    )

    const result = await connectPlatform(formData)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('LinkedIn connected successfully')
      setOpen(false)
      setOrganizationId('')
      setAccessToken('')
    }

    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Connect</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect LinkedIn</DialogTitle>
          <DialogDescription>
            Enter your LinkedIn organization credentials to start tracking metrics.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organizationId">Organization ID</Label>
            <Input
              id="organizationId"
              placeholder="12345678"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-muted-foreground text-xs">
              Found in your LinkedIn Company Page URL (e.g., linkedin.com/company/12345678)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <Textarea
              id="accessToken"
              placeholder="Enter your access token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Generate at developers.linkedin.com with r_organization_social and
              r_organization_admin scopes
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
