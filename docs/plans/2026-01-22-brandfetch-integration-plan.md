# Brandfetch Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a magic wand button to organization settings that fetches brand assets from Brandfetch API and lets users selectively apply them.

**Architecture:** Magic wand button → Server action fetches Brandfetch API → Preview modal displays results → User selects fields → Form populated → User saves.

**Tech Stack:** Brandfetch API, Supabase Storage, Next.js Server Actions, Shadcn UI Dialog

---

## Phase 1: Database Schema

### Task 1.1: Add Brand Fields Migration

**Files:**
- Create: `supabase/migrations/20260122000001_add_brand_fields.sql`

**Step 1: Create the migration file**

```sql
-- Add brand fields for Brandfetch integration
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN organizations.social_links IS 'Array of {platform, url} objects from Brandfetch';
```

**Step 2: Apply migration locally**

Run: `supabase db reset`

**Step 3: Verify columns exist**

Run: `supabase db dump --schema public | grep -A5 "organizations"`

**Step 4: Commit**

```bash
git add supabase/migrations/20260122000001_add_brand_fields.sql
git commit -m "feat: add brand fields migration for Brandfetch integration"
```

---

## Phase 2: Brandfetch API Client

### Task 2.1: Create Brandfetch Types

**Files:**
- Create: `lib/brandfetch/types.ts`

**Step 1: Create the types file**

```typescript
// Brandfetch API response types

export interface BrandfetchLogo {
  theme: 'dark' | 'light' | null
  type: 'icon' | 'logo' | 'symbol' | 'other'
  formats: BrandfetchFormat[]
}

export interface BrandfetchFormat {
  src: string
  format: string
  height?: number
  width?: number
  size?: number
}

export interface BrandfetchColor {
  hex: string
  type: 'accent' | 'dark' | 'light' | 'brand'
  brightness: number
}

export interface BrandfetchLink {
  name: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'github' | 'crunchbase'
  url: string
}

export interface BrandfetchCompany {
  employees?: string | null
  foundedYear?: number | null
  kind?: string | null
  location?: {
    city?: string
    country?: string
    countryCode?: string
    region?: string
    state?: string
    subregion?: string
  }
}

export interface BrandfetchResponse {
  id: string
  name: string | null
  domain: string
  claimed: boolean
  description: string | null
  longDescription: string | null
  qualityScore: number
  logos: BrandfetchLogo[]
  colors: BrandfetchColor[]
  fonts: Array<{ name: string | null; type: 'title' | 'body'; origin: string }>
  images: Array<{ type: string; formats: BrandfetchFormat[] }>
  links: BrandfetchLink[]
  company: BrandfetchCompany | null
}

// Normalized brand data for our app
export interface BrandData {
  name: string | null
  description: string | null
  logo: {
    url: string
    format: string
  } | null
  colors: {
    primary: string | null
    secondary: string | null
    accent: string | null
  }
  socialLinks: Array<{ platform: string; url: string }>
  location: {
    city: string | null
    country: string | null
  }
  raw: BrandfetchResponse // Store full response for future use
}
```

**Step 2: Commit**

```bash
git add lib/brandfetch/types.ts
git commit -m "feat: add Brandfetch API types"
```

---

### Task 2.2: Create Brandfetch Client

**Files:**
- Create: `lib/brandfetch/client.ts`

**Step 1: Create the client file**

```typescript
import type { BrandfetchResponse, BrandData } from './types'

const BRANDFETCH_API_URL = 'https://api.brandfetch.io/v2/brands'

export class BrandfetchError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = 'BrandfetchError'
  }
}

/**
 * Extract domain from a URL
 * e.g., "https://www.example.com/about" -> "example.com"
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove www. prefix if present
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    throw new Error('Invalid URL format')
  }
}

/**
 * Fetch brand data from Brandfetch API
 */
export async function fetchBrandfetch(domain: string): Promise<BrandfetchResponse> {
  const apiKey = process.env.BRANDFETCH_API_KEY
  if (!apiKey) {
    throw new Error('BRANDFETCH_API_KEY is not configured')
  }

  const response = await fetch(`${BRANDFETCH_API_URL}/domain/${domain}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new BrandfetchError('No brand data found for this domain', 404)
    }
    if (response.status === 429) {
      throw new BrandfetchError('Too many requests. Please wait a moment.', 429)
    }
    throw new BrandfetchError('Failed to fetch brand data', response.status)
  }

  return response.json()
}

/**
 * Select the best logo from Brandfetch response
 * Preference: light theme > any theme, logo type > icon > symbol
 * Format preference: SVG > PNG > JPG
 */
function selectBestLogo(logos: BrandfetchResponse['logos']): BrandData['logo'] {
  if (!logos || logos.length === 0) return null

  // Sort by preference
  const sorted = [...logos].sort((a, b) => {
    // Prefer light theme
    const themeScore = (logo: typeof a) => (logo.theme === 'light' ? 2 : logo.theme === null ? 1 : 0)
    // Prefer logo type
    const typeScore = (logo: typeof a) => {
      if (logo.type === 'logo') return 3
      if (logo.type === 'icon') return 2
      if (logo.type === 'symbol') return 1
      return 0
    }
    return themeScore(b) + typeScore(b) - (themeScore(a) + typeScore(a))
  })

  const best = sorted[0]
  if (!best.formats || best.formats.length === 0) return null

  // Sort formats by preference: SVG > PNG > others
  const sortedFormats = [...best.formats].sort((a, b) => {
    const formatScore = (f: typeof a) => {
      if (f.format === 'svg') return 3
      if (f.format === 'png') return 2
      return 1
    }
    return formatScore(b) - formatScore(a)
  })

  return {
    url: sortedFormats[0].src,
    format: sortedFormats[0].format,
  }
}

/**
 * Extract colors from Brandfetch response
 * Maps to our primary/secondary/accent structure
 */
function extractColors(colors: BrandfetchResponse['colors']): BrandData['colors'] {
  if (!colors || colors.length === 0) {
    return { primary: null, secondary: null, accent: null }
  }

  // Find colors by type
  const brandColor = colors.find((c) => c.type === 'brand')
  const accentColor = colors.find((c) => c.type === 'accent')
  const lightColor = colors.find((c) => c.type === 'light')
  const darkColor = colors.find((c) => c.type === 'dark')

  return {
    primary: brandColor?.hex || darkColor?.hex || colors[0]?.hex || null,
    secondary: lightColor?.hex || null,
    accent: accentColor?.hex || null,
  }
}

/**
 * Normalize Brandfetch response to our app's data structure
 */
export function normalizeBrandData(response: BrandfetchResponse): BrandData {
  return {
    name: response.name,
    description: response.description,
    logo: selectBestLogo(response.logos),
    colors: extractColors(response.colors),
    socialLinks: (response.links || []).map((link) => ({
      platform: link.name,
      url: link.url,
    })),
    location: {
      city: response.company?.location?.city || null,
      country: response.company?.location?.country || null,
    },
    raw: response,
  }
}
```

**Step 2: Commit**

```bash
git add lib/brandfetch/client.ts
git commit -m "feat: add Brandfetch API client with normalization"
```

---

### Task 2.3: Create Brandfetch Server Action

**Files:**
- Create: `lib/brandfetch/actions.ts`

**Step 1: Create the server action**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { canManageOrg } from '@/lib/permissions'
import { fetchBrandfetch, extractDomain, normalizeBrandData, BrandfetchError } from './client'
import type { BrandData } from './types'

export interface FetchBrandDataResult {
  error?: string
  data?: BrandData
}

export async function fetchBrandData(websiteUrl: string): Promise<FetchBrandDataResult> {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageOrg(userRecord.role)) {
    return { error: 'Only admins can fetch brand data' }
  }

  // Extract domain and fetch
  try {
    const domain = extractDomain(websiteUrl)
    const response = await fetchBrandfetch(domain)
    const data = normalizeBrandData(response)
    return { data }
  } catch (error) {
    console.error('[Brandfetch Error]', {
      type: 'fetch_brand',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })

    if (error instanceof BrandfetchError) {
      if (error.status === 404) {
        return { error: 'No brand data found for this domain' }
      }
      if (error.status === 429) {
        return { error: 'Too many requests. Please wait a moment.' }
      }
    }

    return { error: 'Failed to fetch brand data. Please try again.' }
  }
}

export interface UploadBrandLogoResult {
  error?: string
  logoUrl?: string
}

export async function uploadBrandLogo(
  imageUrl: string,
  format: string
): Promise<UploadBrandLogoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageOrg(userRecord.role)) {
    return { error: 'Only admins can upload logos' }
  }

  try {
    // Download image from Brandfetch CDN
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error('Failed to download image')
    }

    const blob = await response.blob()
    const orgId = userRecord.organization_id
    const fileExt = format === 'svg' ? 'svg' : format === 'png' ? 'png' : 'jpg'
    const filePath = `${orgId}/logo.${fileExt}`
    const contentType =
      format === 'svg' ? 'image/svg+xml' : format === 'png' ? 'image/png' : 'image/jpeg'

    // Delete existing logo files first
    const { data: existingFiles } = await supabase.storage.from('organization-logos').list(orgId)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${orgId}/${f.name}`)
      await supabase.storage.from('organization-logos').remove(filesToDelete)
    }

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('organization-logos')
      .upload(filePath, blob, {
        upsert: true,
        contentType,
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('organization-logos').getPublicUrl(filePath)

    return { logoUrl: publicUrl }
  } catch (error) {
    console.error('[Brand Logo Upload Error]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to upload logo' }
  }
}
```

**Step 2: Commit**

```bash
git add lib/brandfetch/actions.ts
git commit -m "feat: add Brandfetch server actions"
```

---

## Phase 3: Preview Modal Component

### Task 3.1: Create Social Icon Component

**Files:**
- Create: `components/icons/social-icons.tsx`

**Step 1: Create the social icons file**

```typescript
import { Twitter, Facebook, Instagram, Linkedin, Youtube, Github, Link } from 'lucide-react'

const iconMap = {
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  github: Github,
  crunchbase: Link,
} as const

export type SocialPlatform = keyof typeof iconMap

export function SocialIcon({
  platform,
  className,
}: {
  platform: string
  className?: string
}) {
  const Icon = iconMap[platform as SocialPlatform] || Link
  return <Icon className={className} />
}
```

**Step 2: Commit**

```bash
git add components/icons/social-icons.tsx
git commit -m "feat: add social platform icons component"
```

---

### Task 3.2: Create Brand Fetch Modal

**Files:**
- Create: `components/settings/brand-fetch-modal.tsx`

**Step 1: Create the modal component**

```typescript
'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SocialIcon } from '@/components/icons/social-icons'
import type { BrandData } from '@/lib/brandfetch/types'

interface BrandFetchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandData: BrandData
  onApply: (selections: BrandSelections) => void
}

export interface BrandSelections {
  logo: boolean
  colors: boolean
  description: boolean
  socialLinks: boolean
  location: boolean
}

export function BrandFetchModal({ open, onOpenChange, brandData, onApply }: BrandFetchModalProps) {
  const [selections, setSelections] = useState<BrandSelections>({
    logo: !!brandData.logo,
    colors: !!(brandData.colors.primary || brandData.colors.secondary || brandData.colors.accent),
    description: !!brandData.description,
    socialLinks: brandData.socialLinks.length > 0,
    location: !!(brandData.location.city || brandData.location.country),
  })

  const hasAnySelection = Object.values(selections).some(Boolean)

  function toggleSelection(key: keyof BrandSelections) {
    setSelections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleApply() {
    onApply(selections)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Brand Assets Found</DialogTitle>
          <DialogDescription>
            {brandData.name || 'Unknown Brand'} - Select which assets to apply
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Logo */}
          {brandData.logo && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="logo"
                checked={selections.logo}
                onCheckedChange={() => toggleSelection('logo')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="logo" className="cursor-pointer font-medium">
                  Logo
                </Label>
                <div className="bg-muted flex h-16 items-center justify-center rounded-md p-2">
                  <Image
                    src={brandData.logo.url}
                    alt="Brand logo"
                    width={120}
                    height={48}
                    className="max-h-12 w-auto object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          )}

          {/* Colors */}
          {(brandData.colors.primary || brandData.colors.secondary || brandData.colors.accent) && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="colors"
                checked={selections.colors}
                onCheckedChange={() => toggleSelection('colors')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="colors" className="cursor-pointer font-medium">
                  Colors
                </Label>
                <div className="flex gap-2">
                  {brandData.colors.primary && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: brandData.colors.primary }}
                      />
                      <span className="font-mono text-xs">{brandData.colors.primary}</span>
                    </div>
                  )}
                  {brandData.colors.secondary && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: brandData.colors.secondary }}
                      />
                      <span className="font-mono text-xs">{brandData.colors.secondary}</span>
                    </div>
                  )}
                  {brandData.colors.accent && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: brandData.colors.accent }}
                      />
                      <span className="font-mono text-xs">{brandData.colors.accent}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {brandData.description && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="description"
                checked={selections.description}
                onCheckedChange={() => toggleSelection('description')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="description" className="cursor-pointer font-medium">
                  Description
                </Label>
                <p className="text-muted-foreground text-sm">{brandData.description}</p>
              </div>
            </div>
          )}

          {/* Social Links */}
          {brandData.socialLinks.length > 0 && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="socialLinks"
                checked={selections.socialLinks}
                onCheckedChange={() => toggleSelection('socialLinks')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="socialLinks" className="cursor-pointer font-medium">
                  Social Links
                </Label>
                <div className="flex flex-wrap gap-2">
                  {brandData.socialLinks.map((link) => (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                    >
                      <SocialIcon platform={link.platform} className="h-4 w-4" />
                      <span className="capitalize">{link.platform}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          {(brandData.location.city || brandData.location.country) && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="location"
                checked={selections.location}
                onCheckedChange={() => toggleSelection('location')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="location" className="cursor-pointer font-medium">
                  Location
                </Label>
                <p className="text-muted-foreground text-sm">
                  {[brandData.location.city, brandData.location.country].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasAnySelection}>
            Apply Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/brand-fetch-modal.tsx
git commit -m "feat: add Brandfetch preview modal component"
```

---

## Phase 4: Integrate into Organization Form

### Task 4.1: Update Organization Form Props and Page

**Files:**
- Modify: `app/settings/organization/page.tsx`
- Modify: `components/settings/organization-form.tsx`

**Step 1: Update page.tsx to fetch new fields**

In `app/settings/organization/page.tsx`, update the select query (line 35-37):

```typescript
  // Get organization details with industry relationship
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, industry, logo_url, primary_color, secondary_color, accent_color, website_url, description, city, country, social_links'
    )
    .eq('id', userRecord.organization_id)
    .single()
```

Update the OrganizationForm props (lines 67-78):

```typescript
      <OrganizationForm
        organizationId={org.id}
        name={org.name}
        industryId={org.industry || ''}
        logoUrl={org.logo_url || ''}
        primaryColor={org.primary_color}
        secondaryColor={org.secondary_color}
        accentColor={org.accent_color}
        industries={industries || []}
        websiteUrl={org.website_url || ''}
        existingAuditCount={auditCount || 0}
        description={org.description || ''}
        city={org.city || ''}
        country={org.country || ''}
        socialLinks={org.social_links || []}
      />
```

**Step 2: Commit page changes**

```bash
git add app/settings/organization/page.tsx
git commit -m "feat: fetch new brand fields in organization page"
```

---

### Task 4.2: Update Organization Form Component

**Files:**
- Modify: `components/settings/organization-form.tsx`

**Step 1: Add imports and update interface**

At the top of the file, add new imports:

```typescript
import { Wand2, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Textarea } from '@/components/ui/textarea'
import { BrandFetchModal, type BrandSelections } from '@/components/settings/brand-fetch-modal'
import { fetchBrandData, uploadBrandLogo } from '@/lib/brandfetch/actions'
import { SocialIcon } from '@/components/icons/social-icons'
import type { BrandData } from '@/lib/brandfetch/types'
```

Update the props interface:

```typescript
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
```

**Step 2: Add new state and handlers**

After existing state declarations, add:

```typescript
  const [description, setDescription] = useState(initialDescription)
  const [city, setCity] = useState(initialCity)
  const [country, setCountry] = useState(initialCountry)
  const [socialLinks, setSocialLinks] = useState(initialSocialLinks)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)

  // Brandfetch state
  const [isFetchingBrand, setIsFetchingBrand] = useState(false)
  const [brandData, setBrandData] = useState<BrandData | null>(null)
  const [showBrandModal, setShowBrandModal] = useState(false)
```

Add the fetch handler:

```typescript
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
```

Update hasChanges to include new fields:

```typescript
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
```

**Step 3: Update CardHeader with magic wand button**

Replace the CardHeader (around line 148-154):

```typescript
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
```

**Step 4: Add description field after website URL**

After the websiteUrl input section, add:

```typescript
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
```

**Step 5: Add location fields**

After description, add:

```typescript
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
```

**Step 6: Add social links display (read-only for now)**

After location fields:

```typescript
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
```

**Step 7: Add modal at end of component (before closing Card tag)**

```typescript
      {brandData && (
        <BrandFetchModal
          open={showBrandModal}
          onOpenChange={setShowBrandModal}
          brandData={brandData}
          onApply={handleApplyBrandData}
        />
      )}
```

**Step 8: Add hidden inputs for new fields in the form**

Add before the submit button:

```typescript
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="country" value={country} />
          <input type="hidden" name="socialLinks" value={JSON.stringify(socialLinks)} />
          <input type="hidden" name="logoUrl" value={logoUrl} />
```

**Step 9: Commit**

```bash
git add components/settings/organization-form.tsx
git commit -m "feat: integrate Brandfetch into organization form"
```

---

### Task 4.3: Update Organization Action

**Files:**
- Modify: `app/settings/organization/actions.ts`

**Step 1: Update updateOrganization to handle new fields**

Add parsing for new fields after existing field parsing:

```typescript
  const description = formData.get('description') as string | null
  const city = formData.get('city') as string | null
  const country = formData.get('country') as string | null
  const socialLinksJson = formData.get('socialLinks') as string | null

  let socialLinks: Array<{ platform: string; url: string }> = []
  if (socialLinksJson) {
    try {
      socialLinks = JSON.parse(socialLinksJson)
    } catch {
      // Invalid JSON, use empty array
    }
  }
```

Update the Supabase update call to include new fields:

```typescript
  const { error } = await supabase
    .from('organizations')
    .update({
      name: name.trim(),
      industry: industryId || null,
      logo_url: logoUrl?.trim() || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      website_url: newWebsiteUrl,
      description: description?.trim() || null,
      city: city?.trim() || null,
      country: country?.trim() || null,
      social_links: socialLinks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userRecord.organization_id)
```

**Step 2: Commit**

```bash
git add app/settings/organization/actions.ts
git commit -m "feat: update organization action for new brand fields"
```

---

## Phase 5: Testing & Verification

### Task 5.1: Manual Testing

**Steps:**

1. Run: `supabase db reset` to apply migrations
2. Run: `npm run dev`
3. Navigate to `/settings/organization`
4. Verify magic wand button appears (disabled without URL)
5. Enter a website URL (e.g., `https://nike.com`)
6. Click magic wand button
7. Verify modal appears with brand data
8. Select some fields and click Apply
9. Verify form fields are populated
10. Click Save and verify data persists

### Task 5.2: Run Linting and Build

**Run:**
```bash
npm run lint && npm run test:unit && npm run build
```

**Expected:** All pass

### Task 5.3: Final Commit and Push

```bash
git add -A
git status  # Review all changes
git push origin main
```

---

## File Summary

| File | Action |
|------|--------|
| `supabase/migrations/20260122000001_add_brand_fields.sql` | Create |
| `lib/brandfetch/types.ts` | Create |
| `lib/brandfetch/client.ts` | Create |
| `lib/brandfetch/actions.ts` | Create |
| `components/icons/social-icons.tsx` | Create |
| `components/settings/brand-fetch-modal.tsx` | Create |
| `components/settings/organization-form.tsx` | Modify |
| `app/settings/organization/page.tsx` | Modify |
| `app/settings/organization/actions.ts` | Modify |
