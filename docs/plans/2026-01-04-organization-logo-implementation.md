# Organization Logo Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add file upload for organization logos with display in header and email templates.

**Architecture:** Upload files to Supabase Storage public bucket, store URL in organizations table, render in header component and email templates with initials fallback.

**Tech Stack:** Supabase Storage, Next.js Server Actions, React Email, Tailwind CSS

---

### Task 1: Create Storage Bucket Migration

**Files:**
- Create: `supabase/migrations/20260104000001_create_logo_storage.sql`

**Step 1: Write the migration**

```sql
-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to logos
CREATE POLICY "Public can view organization logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

-- Allow org admins to upload logos for their organization
CREATE POLICY "Org admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow org admins to update logos for their organization
CREATE POLICY "Org admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow org admins to delete logos for their organization
CREATE POLICY "Org admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260104000001_create_logo_storage.sql
git commit -m "feat: add storage bucket for organization logos"
```

---

### Task 2: Add Logo Upload Server Actions

**Files:**
- Modify: `app/settings/organization/actions.ts`

**Step 1: Add uploadLogo action**

Add these imports at the top and new actions after `updateOrganization`:

```typescript
// Add to existing imports - nothing new needed

export async function uploadLogo(formData: FormData): Promise<{ error?: string; logoUrl?: string }> {
  const file = formData.get('file') as File

  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }

  // Validate file size (2MB max)
  const MAX_SIZE = 2 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return { error: 'File size must be less than 2MB' }
  }

  // Validate file type
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'File must be PNG, JPG, or SVG' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization and verify they're an admin
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can upload logos' }
  }

  const orgId = userRecord.organization_id
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
  const filePath = `${orgId}/logo.${fileExt}`

  // Delete existing logo files first (there might be different extensions)
  const { data: existingFiles } = await supabase.storage
    .from('organization-logos')
    .list(orgId)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `${orgId}/${f.name}`)
    await supabase.storage.from('organization-logos').remove(filesToDelete)
  }

  // Upload new logo
  const { error: uploadError } = await supabase.storage
    .from('organization-logos')
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    console.error('[Logo Upload Error]', { error: uploadError, timestamp: new Date().toISOString() })
    return { error: 'Failed to upload logo' }
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('organization-logos')
    .getPublicUrl(filePath)

  // Update organization with new logo URL
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', orgId)

  if (updateError) {
    console.error('[Logo Update Error]', { error: updateError, timestamp: new Date().toISOString() })
    return { error: 'Failed to save logo' }
  }

  revalidatePath('/settings/organization')
  revalidatePath('/dashboard')

  return { logoUrl: publicUrl }
}

export async function removeLogo(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization and verify they're an admin
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can remove logos' }
  }

  const orgId = userRecord.organization_id

  // Delete all logo files for this org
  const { data: existingFiles } = await supabase.storage
    .from('organization-logos')
    .list(orgId)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `${orgId}/${f.name}`)
    await supabase.storage.from('organization-logos').remove(filesToDelete)
  }

  // Clear logo URL from organization
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('id', orgId)

  if (updateError) {
    console.error('[Logo Remove Error]', { error: updateError, timestamp: new Date().toISOString() })
    return { error: 'Failed to remove logo' }
  }

  revalidatePath('/settings/organization')
  revalidatePath('/dashboard')

  return { success: true }
}
```

**Step 2: Commit**

```bash
git add app/settings/organization/actions.ts
git commit -m "feat: add uploadLogo and removeLogo server actions"
```

---

### Task 3: Create LogoUpload Component

**Files:**
- Create: `components/settings/logo-upload.tsx`

**Step 1: Create the component**

```tsx
'use client'

import { useState, useRef } from 'react'
import { uploadLogo, removeLogo } from '@/app/settings/organization/actions'
import { Button } from '@/components/ui/button'
import { showSuccess, showError } from '@/components/ui/sonner'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface LogoUploadProps {
  currentLogoUrl: string | null
  organizationName: string
  primaryColor: string
}

export function LogoUpload({ currentLogoUrl, organizationName, primaryColor }: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const initial = organizationName.charAt(0).toUpperCase()

  async function handleFileSelect(file: File) {
    // Client-side validation
    const MAX_SIZE = 2 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      showError('File size must be less than 2MB')
      return
    }

    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!ALLOWED_TYPES.includes(file.type)) {
      showError('File must be PNG, JPG, or SVG')
      return
    }

    setIsUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadLogo(formData)

    if (result.error) {
      showError(result.error)
    } else if (result.logoUrl) {
      setPreviewUrl(result.logoUrl)
      showSuccess('Logo uploaded successfully!')
      router.refresh()
    }

    setIsUploading(false)
  }

  async function handleRemove() {
    setIsRemoving(true)

    const result = await removeLogo()

    if (result.error) {
      showError(result.error)
    } else {
      setPreviewUrl(null)
      showSuccess('Logo removed successfully!')
      router.refresh()
    }

    setIsRemoving(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Preview */}
          <div className="relative">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Organization logo"
                width={80}
                height={80}
                className="rounded-lg object-contain"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-lg flex items-center justify-center text-2xl font-bold text-white"
                style={{ backgroundColor: primaryColor || '#6B7280' }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <p className="text-sm text-neutral-600">
              {isUploading ? 'Uploading...' : 'Drag and drop your logo here, or click to browse'}
            </p>
            <p className="text-xs text-neutral-400">
              PNG, JPG, or SVG. Max 2MB.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRemoving}
            >
              {isUploading ? 'Uploading...' : 'Choose File'}
            </Button>
            {previewUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={isUploading || isRemoving}
                className="text-red-600 hover:text-red-700"
              >
                {isRemoving ? 'Removing...' : 'Remove'}
              </Button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/logo-upload.tsx
git commit -m "feat: add LogoUpload component with drag-and-drop"
```

---

### Task 4: Update Organization Form

**Files:**
- Modify: `components/settings/organization-form.tsx`

**Step 1: Replace URL input with LogoUpload component**

Replace the logo URL input section (lines 125-139) with:

```tsx
// Add import at top
import { LogoUpload } from '@/components/settings/logo-upload'

// Remove logoUrl state since it's handled by LogoUpload
// Remove logoUrl from hasChanges check

// Replace the logo URL input div with:
<div className="space-y-2">
  <Label>Organization Logo</Label>
  <LogoUpload
    currentLogoUrl={initialLogoUrl || null}
    organizationName={name}
    primaryColor={primaryColor}
  />
</div>
```

Also remove `logoUrl` from the form state and hasChanges since it's now handled separately by the LogoUpload component.

**Step 2: Commit**

```bash
git add components/settings/organization-form.tsx
git commit -m "feat: replace logo URL input with file upload component"
```

---

### Task 5: Create OrgLogo Component for Header

**Files:**
- Create: `components/dashboard/org-logo.tsx`

**Step 1: Create the component**

```tsx
import Image from 'next/image'

interface OrgLogoProps {
  logoUrl: string | null
  orgName: string
  primaryColor?: string
  size?: number
}

export function OrgLogo({ logoUrl, orgName, primaryColor, size = 40 }: OrgLogoProps) {
  const initial = orgName.charAt(0).toUpperCase()

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${orgName} logo`}
        width={size}
        height={size}
        className="rounded-lg object-contain"
      />
    )
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: primaryColor || '#6B7280',
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/dashboard/org-logo.tsx
git commit -m "feat: add OrgLogo component with initials fallback"
```

---

### Task 6: Update Header to Show Logo

**Files:**
- Modify: `components/dashboard/header.tsx`

**Step 1: Add logo to header**

Update the query to include logo_url and primary_color, then render OrgLogo:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgLogo } from '@/components/dashboard/org-logo'

export async function Header() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error } = await supabase
    .from('users')
    .select('organization:organizations(name, logo_url, primary_color), first_name, last_name')
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    redirect('/login')
  }

  const org = userRecord?.organization as unknown as { name: string; logo_url: string | null; primary_color: string | null } | null
  const orgName = org?.name || 'Organization'
  const logoUrl = org?.logo_url || null
  const primaryColor = org?.primary_color || null
  const userEmail = user?.email || ''
  const firstName = userRecord?.first_name || userEmail.split('@')[0]
  const lastName = userRecord?.last_name || ''

  const initials = lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    : firstName.substring(0, 2).toUpperCase()

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <OrgLogo logoUrl={logoUrl} orgName={orgName} primaryColor={primaryColor} size={40} />
        <h2 className="text-lg font-semibold">{orgName}</h2>
      </div>
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} initials={initials} />
    </header>
  )
}
```

**Step 2: Commit**

```bash
git add components/dashboard/header.tsx
git commit -m "feat: display organization logo in header"
```

---

### Task 7: Update Email Template with Logo

**Files:**
- Modify: `emails/invite-email.tsx`

**Step 1: Add logo to email template**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'

interface InviteEmailProps {
  inviteLink: string
  organizationName: string
  invitedByEmail: string
  role: string
  logoUrl?: string | null
}

export default function InviteEmail({
  inviteLink,
  organizationName,
  invitedByEmail,
  role,
  logoUrl,
}: InviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {organizationName} on Selo IO</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto py-12 px-4">
            {/* Logo + Org Name Header */}
            <Section className="mb-6">
              <table cellPadding="0" cellSpacing="0" style={{ width: 'auto' }}>
                <tr>
                  {logoUrl && (
                    <td style={{ paddingRight: '12px', verticalAlign: 'middle' }}>
                      <Img
                        src={logoUrl}
                        alt={organizationName}
                        width="40"
                        height="40"
                        style={{ borderRadius: '8px', objectFit: 'contain' }}
                      />
                    </td>
                  )}
                  <td style={{ verticalAlign: 'middle' }}>
                    <Text className="text-xl font-bold text-neutral-900 m-0">
                      {organizationName}
                    </Text>
                  </td>
                </tr>
              </table>
            </Section>

            <Heading className="text-2xl font-bold text-neutral-900 mb-4">
              You're Invited!
            </Heading>
            <Text className="text-neutral-700 mb-4">
              {invitedByEmail} has invited you to join {organizationName} on Selo IO
              as a <strong>{role.replace('_', ' ')}</strong>.
            </Text>
            <Text className="text-neutral-700 mb-6">
              Selo IO helps marketing teams track campaign performance across
              HubSpot, Google Analytics, LinkedIn, and more.
            </Text>
            <Section className="mb-6">
              <Button
                href={inviteLink}
                className="bg-neutral-900 text-white px-6 py-3 rounded-md font-medium"
              >
                Accept Invitation
              </Button>
            </Section>
            <Text className="text-sm text-neutral-500">
              This invitation will expire in 7 days. If you didn't expect this
              invitation, you can safely ignore this email.
            </Text>
            <Text className="text-sm text-neutral-500 mt-4">
              Or copy and paste this link:{' '}
              <Link href={inviteLink} className="text-blue-600">
                {inviteLink}
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
```

**Step 2: Commit**

```bash
git add emails/invite-email.tsx
git commit -m "feat: add organization logo to invite email template"
```

---

### Task 8: Update Invite Actions to Pass Logo URL

**Files:**
- Modify: `app/settings/team/actions.ts`

**Step 1: Fetch and pass logoUrl to email template**

In the `sendInvite` function, update the org query to include logo_url:

```typescript
// Update the org query (around line 66-70):
const { data: org } = await supabase
  .from('organizations')
  .select('name, logo_url')
  .eq('id', userRecord.organization_id)
  .single()

// Update the email call to include logoUrl:
react: InviteEmail({
  inviteLink,
  organizationName: org?.name || 'the organization',
  invitedByEmail: user.email!,
  role,
  logoUrl: org?.logo_url || null,
}),
```

Do the same for the `resendInvite` function.

**Step 2: Commit**

```bash
git add app/settings/team/actions.ts
git commit -m "feat: pass organization logo to invite emails"
```

---

### Task 9: Add Next.js Image Domain Config

**Files:**
- Modify: `next.config.ts`

**Step 1: Add Supabase storage domain**

Add the Supabase storage domain to allowed image sources:

```typescript
// In next.config.ts, add images config:
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
  ],
},
```

**Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat: allow Supabase storage images in Next.js"
```

---

### Task 10: Run Tests and Build

**Step 1: Run unit tests**

```bash
npm run test:unit
```

Expected: All tests pass

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 3: Commit any fixes if needed**

---

### Task 11: Push to Remote

**Step 1: Push all changes**

```bash
git push
```

---

## Testing Checklist

- [ ] Can upload PNG logo
- [ ] Can upload JPG logo
- [ ] Can upload SVG logo
- [ ] Rejects files > 2MB
- [ ] Rejects non-image files
- [ ] Logo displays in header
- [ ] Initials fallback works in header
- [ ] Logo displays in invite email
- [ ] Can remove logo
- [ ] New upload replaces old logo
