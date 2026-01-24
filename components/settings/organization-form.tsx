'use client'

import { useState } from 'react'
import { updateOrganization } from '@/app/settings/organization/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'
import { showSuccess, showError } from '@/components/ui/sonner'
import { Wand2, Loader2 } from 'lucide-react'
import { BrandFetchModal, type BrandSelections } from '@/components/settings/brand-fetch-modal'
import { fetchBrandData, uploadBrandLogo } from '@/lib/brandfetch/actions'
import { SocialIcon } from '@/components/icons/social-icons'
import type { BrandData } from '@/lib/brandfetch/types'

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
  description: string
  city: string
  country: string
  socialLinks: Array<{ platform: string; url: string }>
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
  description: initialDescription,
  city: initialCity,
  country: initialCountry,
  socialLinks: initialSocialLinks,
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

  // New brand fields state
  const [description, setDescription] = useState(initialDescription)
  const [city, setCity] = useState(initialCity)
  const [country, setCountry] = useState(initialCountry)
  const [socialLinks, setSocialLinks] = useState(initialSocialLinks)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)

  // Brandfetch state
  const [isFetchingBrand, setIsFetchingBrand] = useState(false)
  const [brandData, setBrandData] = useState<BrandData | null>(null)
  const [showBrandModal, setShowBrandModal] = useState(false)

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

  // Brandfetch handlers
  async function handleFetchBrand() {
    if (!websiteUrl) return

    setIsFetchingBrand(true)
    const result = await fetchBrandData(websiteUrl)
    setIsFetchingBrand(false)

    if (result.error) {
      showError(result.error)
      return
    }

    if (result.data) {
      setBrandData(result.data)
      setShowBrandModal(true)
    }
  }

  async function handleApplyBrandData(selections: BrandSelections) {
    if (!brandData) return

    setIsLoading(true)

    // Apply logo if selected
    if (selections.logo && brandData.logo) {
      const result = await uploadBrandLogo(brandData.logo.url, brandData.logo.format)
      if (result.logoUrl) {
        setLogoUrl(result.logoUrl)
      } else if (result.error) {
        showError(result.error)
      }
    }

    // Apply colors if selected
    if (selections.colors) {
      if (brandData.colors.primary) setPrimaryColor(brandData.colors.primary)
      if (brandData.colors.secondary) setSecondaryColor(brandData.colors.secondary)
      if (brandData.colors.accent) setAccentColor(brandData.colors.accent)
    }

    // Apply description if selected
    if (selections.description && brandData.description) {
      setDescription(brandData.description)
    }

    // Apply social links if selected
    if (selections.socialLinks) {
      setSocialLinks(brandData.socialLinks)
    }

    // Apply location if selected
    if (selections.location) {
      if (brandData.location.city) setCity(brandData.location.city)
      if (brandData.location.country) setCountry(brandData.location.country)
    }

    setIsLoading(false)
    showSuccess('Brand assets applied! Click Save to confirm changes.')
  }

  // Check if save button should be disabled
  // Note: Logo changes are handled separately by LogoUpload component
  const hasChanges =
    name !== initialName ||
    industryId !== initialIndustryId ||
    primaryColor !== initialPrimaryColor ||
    secondaryColor !== initialSecondaryColor ||
    accentColor !== initialAccentColor ||
    websiteUrl !== initialWebsiteUrl ||
    description !== initialDescription ||
    city !== initialCity ||
    country !== initialCountry ||
    JSON.stringify(socialLinks) !== JSON.stringify(initialSocialLinks) ||
    logoUrl !== initialLogoUrl

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
    <>
      <form action={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Update your organization&apos;s branding and basic information
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleFetchBrand}
                  disabled={!websiteUrl || isFetchingBrand || isLoading}
                >
                  {isFetchingBrand ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {websiteUrl ? 'Fetch brand assets' : 'Add a website URL first'}
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="A short description of your organization..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={2}
              />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  type="text"
                  placeholder="San Francisco"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  type="text"
                  placeholder="United States"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {socialLinks.length > 0 && (
              <div className="space-y-2">
                <Label>Social Links</Label>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-muted hover:bg-muted/80 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors"
                    >
                      <SocialIcon platform={link.platform} className="h-4 w-4" />
                      <span className="capitalize">{link.platform}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Style</CardTitle>
            <CardDescription>Customize your organization&apos;s visual identity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Organization Logo</Label>
              <LogoUpload
                currentLogoUrl={logoUrl || null}
                organizationName={name}
                primaryColor={primaryColor}
              />
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Brand Colors</Label>
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
          </CardContent>
        </Card>

        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="country" value={country} />
        <input type="hidden" name="socialLinks" value={JSON.stringify(socialLinks)} />
        <input type="hidden" name="logoUrl" value={logoUrl} />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaveDisabled}>
            {isLoading ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {brandData && (
        <BrandFetchModal
          open={showBrandModal}
          onOpenChange={setShowBrandModal}
          brandData={brandData}
          onApply={handleApplyBrandData}
        />
      )}

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
    </>
  )
}
