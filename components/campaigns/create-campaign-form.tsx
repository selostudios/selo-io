'use client'

import { useState } from 'react'
import { createCampaign } from '@/app/campaigns/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export function CreateCampaignForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    const result = await createCampaign(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      router.push(`/dashboard/campaigns/${result.campaign.id}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Campaign</CardTitle>
        <CardDescription>Set up a new marketing campaign with tracking parameters</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g., Q1 2026 Thought Leadership"
              required
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input id="start_date" name="start_date" type="date" disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input id="end_date" name="end_date" type="date" disabled={isLoading} />
            </div>
          </div>
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
