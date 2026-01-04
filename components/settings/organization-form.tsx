'use client'

import { useState } from 'react'
import { updateOrganization } from '@/app/settings/organization/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogoUpload } from '@/components/settings/logo-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/components/ui/sonner'

interface Industry {
  id: string
  name: string
}

interface OrganizationFormProps {
  organizationId: string
  name: string
  industryId: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  industries: Industry[]
}

export function OrganizationForm({
  name: initialName,
  industryId: initialIndustryId,
  logoUrl: initialLogoUrl,
  primaryColor: initialPrimaryColor,
  secondaryColor: initialSecondaryColor,
  accentColor: initialAccentColor,
  industries,
}: OrganizationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState(initialName)
  const [industryId, setIndustryId] = useState(initialIndustryId)
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor)
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor)
  const [accentColor, setAccentColor] = useState(initialAccentColor)
  const router = useRouter()

  // Check if save button should be disabled
  // Note: Logo changes are handled separately by LogoUpload component
  const hasChanges =
    name !== initialName ||
    industryId !== initialIndustryId ||
    primaryColor !== initialPrimaryColor ||
    secondaryColor !== initialSecondaryColor ||
    accentColor !== initialAccentColor

  const isSaveDisabled = !name.trim() || !hasChanges || isLoading

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)

    // Add industry to form data
    formData.set('industry', industryId)

    const result = await updateOrganization(formData)

    if (result?.error) {
      showError(result.error)
      setIsLoading(false)
    } else if (result?.success) {
      showSuccess('Organization settings updated successfully!')
      setIsLoading(false)
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Information</CardTitle>
        <CardDescription>
          Update your organization&apos;s branding and basic information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Organization name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select value={industryId} onValueChange={setIndustryId} disabled={isLoading}>
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
            </div>

            <div className="space-y-2">
              <Label>Organization Logo</Label>
              <LogoUpload
                currentLogoUrl={initialLogoUrl || null}
                organizationName={name}
                primaryColor={primaryColor}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Brand Colors</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    name="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={isLoading}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={isLoading}
                    placeholder="#000000"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    name="secondaryColor"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    disabled={isLoading}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    disabled={isLoading}
                    placeholder="#F5F5F0"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="accentColor"
                    name="accentColor"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={isLoading}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={isLoading}
                    placeholder="#666666"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaveDisabled}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
