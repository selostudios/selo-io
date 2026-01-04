# Organization Logo Upload Design

## Overview

Add file upload for organization logos, stored in Supabase Storage, displayed in the app header and email templates.

## Requirements

- **File limits**: Max 2MB, PNG/JPG/SVG only
- **Storage**: Supabase Storage public bucket
- **Header display**: 40x40px rounded corners, beside org name
- **Fallback**: Org initial in colored circle when no logo
- **Email display**: Logo (40px) + org name side-by-side at top
- **Clear UI**: Show file size/format limits in upload UI

## Technical Design

### 1. Supabase Storage Setup

**Bucket**: `organization-logos` (public)

**File path pattern**: `{org_id}/logo.{ext}`
- Each org has one logo (new upload replaces old)
- Public URL: `https://{project}.supabase.co/storage/v1/object/public/organization-logos/{org_id}/logo.png`

**RLS Policies**:
- SELECT: Public (anyone can view)
- INSERT/UPDATE/DELETE: Only org admins

### 2. File Upload Component

Replace URL input in `organization-form.tsx` with:

- Dropzone with drag-and-drop
- Preview thumbnail (current logo or initials fallback)
- Helper text: "PNG, JPG, or SVG. Max 2MB."
- Upload and Remove buttons
- Progress indicator during upload
- Error states for validation failures

**Upload flow**:
1. User selects/drops file
2. Client-side validation (size ≤ 2MB, format in PNG/JPG/SVG)
3. Upload to Supabase Storage
4. Update `logo_url` in organizations table
5. Refresh UI

### 3. Header Display

Update `components/dashboard/header.tsx`:

- Add `logo_url` to organization select query
- Display 40x40px image with rounded corners if logo exists
- Fallback: Org initial in circle (use primary brand color or neutral gray)
- Layout: `[Logo/Initial 40x40] [Org Name]`

### 4. Email Template

Update `emails/invite-email.tsx`:

- Add optional `logoUrl` prop
- Display logo (40px wide) + org name side-by-side at top
- If no logo, show only org name (no initials)

Update `app/settings/team/actions.ts`:
- Fetch org's `logo_url`
- Pass to email template

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration for storage bucket + policies |
| `components/settings/organization-form.tsx` | Replace URL input with file upload |
| `app/settings/organization/actions.ts` | Add uploadLogo, removeLogo actions |
| `components/dashboard/header.tsx` | Add logo/initials display |
| `emails/invite-email.tsx` | Add logo + org name header |
| `app/settings/team/actions.ts` | Pass logoUrl to email template |
