'use client'

import { useState } from 'react'
import { createOrganization } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Industry {
  id: string
  name: string
}

interface CreateOrganizationFormProps {
  industries: Industry[]
}

export function CreateOrganizationForm({ industries }: CreateOrganizationFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [industry, setIndustry] = useState('')

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    // Add industry to form data
    if (industry) {
      formData.set('industry', industry)
    }

    const result = await createOrganization(formData)

    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Your Organization</CardTitle>
        <CardDescription>Set up your first client organization to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g., Badger CPA"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={industry} onValueChange={setIndustry} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select an industry" />
              </SelectTrigger>
              <SelectContent>
                {industries.map((ind) => (
                  <SelectItem key={ind.id} value={ind.id}>
                    {ind.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Organization'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
