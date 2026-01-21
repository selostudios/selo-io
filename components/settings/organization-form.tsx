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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  websiteUrl: string
  existingAuditCount: number
}

export function OrganizationForm({
  name: initialName,
  industryId: initialIndustryId,
  logoUrl: initialLogoUrl,
  primaryColor: initialPrimaryColor,
  secondaryColor: initialSecondaryColor,
  accentColor: initialAccentColor,
  industries,
  websiteUrl: initialWebsiteUrl,
  existingAuditCount,
}: OrganizationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState(initialName)
  const [industryId, setIndustryId] = useState(initialIndustryId)
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor)
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor)
  const [accentColor, setAccentColor] = useState(initialAccentColor)
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl)
  const [websiteUrlError, setWebsiteUrlError] = useState<string | null>(null)
  const [showUrlChangeDialog, setShowUrlChangeDialog] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)
  const router = useRouter()

  // Validate website URL format
  function validateWebsiteUrl(url: string): string | null {
    if (!url) return null // Empty is allowed

    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') {
        return 'URL must start with https://'
      }
      if (!parsed.hostname.includes('.')) {
        return 'Please enter a valid domain (e.g., example.com)'
      }
      return null
    } catch {
      return 'Please enter a valid URL (e.g., https://example.com)'
    }
  }

  function handleWebsiteUrlChange(value: string) {
    setWebsiteUrl(value)
    setWebsiteUrlError(validateWebsiteUrl(value))
  }

  // Check if save button should be disabled
  // Note: Logo changes are handled separately by LogoUpload component
  const hasChanges =
    name !== initialName ||
    industryId !== initialIndustryId ||
    primaryColor !== initialPrimaryColor ||
    secondaryColor !== initialSecondaryColor ||
    accentColor !== initialAccentColor ||
    websiteUrl !== initialWebsiteUrl

  const isSaveDisabled = !name.trim() || !hasChanges || isLoading || !!websiteUrlError

  async function submitForm(formData: FormData) {
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

  async function handleSubmit(formData: FormData) {
    const newUrl = formData.get('websiteUrl') as string
    const urlIsChanging = newUrl !== initialWebsiteUrl && initialWebsiteUrl

    // If URL is changing and audits exist, show confirmation dialog
    if (urlIsChanging && existingAuditCount > 0) {
      setPendingFormData(formData)
      setShowUrlChangeDialog(true)
      return
    }

    // Otherwise proceed normally
    await submitForm(formData)
  }

  function handleConfirmUrlChange() {
    if (pendingFormData) {
      submitForm(pendingFormData)
      setShowUrlChangeDialog(false)
      setPendingFormData(null)
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
                  placeholder="Organization name…"
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
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => handleWebsiteUrlChange(e.target.value)}
                disabled={isLoading}
                aria-invalid={!!websiteUrlError}
              />
              {websiteUrlError ? (
                <p className="text-destructive text-xs">{websiteUrlError}</p>
              ) : (
                <p className="text-muted-foreground text-xs">Used for SEO & AI auditing</p>
              )}
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
                    aria-label="Primary color hex value"
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
                    aria-label="Secondary color hex value"
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
                    aria-label="Accent color hex value"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaveDisabled}>
              {isLoading ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>

      <AlertDialog open={showUrlChangeDialog} onOpenChange={setShowUrlChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Website URL?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  You have {existingAuditCount} audit{existingAuditCount > 1 ? 's' : ''} for{' '}
                  {initialWebsiteUrl}.
                </p>
                <p>Changing your website URL will:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Archive existing audits under &quot;Previous domain&quot;</li>
                  <li>Start fresh audit history for {websiteUrl}</li>
                </ul>
                <p className="text-muted-foreground text-sm">
                  Archived audits will still be viewable but won&apos;t appear in your score trend
                  chart.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUrlChange}>Change URL</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
