# Brandfetch Integration Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to auto-populate organization brand assets (logo, colors, description, social links, location) by fetching from Brandfetch API based on the organization's website URL.

**Architecture:** Magic wand button triggers API fetch → Preview modal displays results → User selects what to apply → Form fields populated → User saves.

**Tech Stack:** Brandfetch API, Supabase Storage, Next.js Server Actions

---

## Database Schema Changes

New columns for `organizations` table:

```sql
ALTER TABLE organizations
ADD COLUMN description TEXT,
ADD COLUMN city TEXT,
ADD COLUMN country TEXT,
ADD COLUMN social_links JSONB DEFAULT '[]';
```

**Social links structure:**
```json
[
  {"platform": "twitter", "url": "https://twitter.com/acme"},
  {"platform": "linkedin", "url": "https://linkedin.com/company/acme"}
]
```

The existing `brand_preferences` JSONB column will store the full Brandfetch response for future use (fonts, images, quality score, etc.).

**Environment variable:** `BRANDFETCH_API_KEY`

---

## UI Components

### Magic Wand Button

- Location: Top-right of organization settings card header
- Icon: `Wand2` from lucide-react
- Disabled state: When `website_url` is empty
- Disabled tooltip: "Add a website URL first"
- Loading state: Spinner replaces wand icon while fetching

### Preview Modal

Title: "Brand Assets Found - {company name}"

Sections with independent checkboxes:

1. **Logo** - Preview image (prefer light theme, type "logo")
2. **Colors** - Color swatches with hex values
3. **Description** - Brand tagline text
4. **Social Links** - Platform icons (clickable, open in new tab)
5. **Location** - City, Country

Buttons: "Cancel" | "Apply Selected"

"Apply Selected" populates form fields but doesn't save - user still clicks the existing Save button.

---

## Data Flow

1. User clicks magic wand button
2. Client calls `fetchBrandData(websiteUrl)` server action
3. Server action:
   - Extracts domain from URL (e.g., `https://acme.com/about` → `acme.com`)
   - Calls Brandfetch API: `GET https://api.brandfetch.io/v2/brands/domain/{domain}`
   - Auth header: `Authorization: Bearer {BRANDFETCH_API_KEY}`
   - Transforms response to our shape
   - Returns data to client
4. Client displays preview modal with fetched data
5. User selects sections to apply, clicks "Apply Selected"
6. Form fields are populated with selected data
7. User clicks existing "Save" button to persist

### Logo Handling

When user applies logo:
1. Server action downloads image from Brandfetch CDN
2. Uploads to Supabase storage at `{org_id}/logo.{format}`
3. Returns Supabase public URL
4. Form updates with new `logo_url`

**Format preference:** SVG > PNG > JPG

User can always override by manually uploading a different logo.

---

## Error Handling

| Scenario | User Feedback |
|----------|---------------|
| Brand not found | Toast: "No brand data found for this domain" |
| API error | Toast: "Failed to fetch brand data. Please try again." |
| Rate limited | Toast: "Too many requests. Please wait a moment." |
| No website URL | Button disabled with tooltip |

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `lib/brandfetch/types.ts` | TypeScript types for API response |
| `lib/brandfetch/client.ts` | Brandfetch API client |
| `lib/brandfetch/actions.ts` | Server action `fetchBrandData()` |
| `components/settings/brand-fetch-modal.tsx` | Preview modal component |
| `supabase/migrations/[timestamp]_add_brand_fields.sql` | New columns |

### Modified Files

| File | Changes |
|------|---------|
| `components/settings/organization-form.tsx` | Add wand button, modal trigger, handle apply |
| `app/settings/organization/page.tsx` | Fetch new fields (description, city, country, social_links) |
| `app/settings/organization/actions.ts` | Update `updateOrganization` for new fields |

---

## Brandfetch API Response (Reference)

Key fields we use:

```typescript
{
  name: string;
  description: string | null;
  logos: Array<{
    theme: 'dark' | 'light' | null;
    type: 'icon' | 'logo' | 'symbol' | 'other';
    formats: Array<{ src: string; format: string; }>;
  }>;
  colors: Array<{
    hex: string;
    type: 'accent' | 'dark' | 'light' | 'brand';
  }>;
  links: Array<{
    name: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'github';
    url: string;
  }>;
  company: {
    location: {
      city: string;
      country: string;
    };
  };
}
```

Full response stored in `brand_preferences` for future theming features.

---

## Social Link Icons

| Platform | Icon |
|----------|------|
| twitter | Twitter icon (or X) |
| facebook | Facebook icon |
| instagram | Instagram icon |
| linkedin | LinkedIn icon |
| youtube | YouTube icon |
| github | GitHub icon |
| crunchbase | Link icon (fallback) |

Icons from lucide-react or custom SVGs. Links open in new tab (`target="_blank" rel="noopener noreferrer"`).
