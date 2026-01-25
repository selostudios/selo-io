# Organization Status & Internal Users Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Selo employees to manage prospect organizations for auditing, with a clear conversion path to customers.

**Architecture:** Internal users (Selo employees) can see all organizations and run audits on any URL. External users (customers) can only see and audit their own organization. Organizations have a status lifecycle: prospect → customer → inactive.

**Tech Stack:** Next.js App Router, Supabase (RLS policies), React state management

---

## Core Concepts

### User Types

| Type                | `is_internal` | `organization_id` | Can See      | Can Audit    |
| ------------------- | ------------- | ----------------- | ------------ | ------------ |
| Internal (Selo)     | `true`        | `NULL`            | All orgs     | Any URL      |
| External (Customer) | `false`       | Required          | Own org only | Own org only |

### Organization Status

| Status     | Description          | Required Fields                            |
| ---------- | -------------------- | ------------------------------------------ |
| `prospect` | Lead for auditing    | name, website_url                          |
| `customer` | Active paying client | name, website_url, industry, contact_email |
| `inactive` | Former customer      | (no change)                                |

---

## Data Model Changes

### Users Table

```sql
-- Make organization_id nullable (internal users don't have one)
ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

-- Add internal flag
ALTER TABLE users ADD COLUMN is_internal BOOLEAN DEFAULT false;
```

### Organizations Table

```sql
-- Add status enum
CREATE TYPE organization_status AS ENUM ('prospect', 'customer', 'inactive');
ALTER TABLE organizations ADD COLUMN status organization_status DEFAULT 'prospect';

-- Add contact_email for conversion requirement
ALTER TABLE organizations ADD COLUMN contact_email TEXT;
```

### Audit Tables

```sql
-- Ensure organization_id is nullable (for one-time URL audits)
-- site_audits.organization_id should already be nullable
-- performance_audits.organization_id should already be nullable
```

### Remove seo_projects

```sql
-- Remove project_id columns from audit tables
ALTER TABLE site_audits DROP COLUMN IF EXISTS project_id;
ALTER TABLE performance_audits DROP COLUMN IF EXISTS project_id;

-- Drop the table
DROP TABLE IF EXISTS seo_projects;
```

---

## RLS Policy Changes

### Organizations

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;

-- Internal users see all, external see own org
CREATE POLICY "View organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Only internal users can create organizations
CREATE POLICY "Create organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
  );

-- Internal users can update any org, external admins can update own org
CREATE POLICY "Update organizations"
  ON organizations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

### Site Audits

```sql
-- Internal: can create for any org or one-time (null)
-- External: can only create for their own org
CREATE POLICY "Create site audits"
  ON site_audits FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    ))
  );

-- Internal: can view all audits
-- External: can view own org's audits
CREATE POLICY "View site audits"
  ON site_audits FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );
```

Similar policies for `performance_audits`.

---

## UI Components

### Header Organization Selector (Internal Users)

Location: Next to Selo logo in header

```
┌──────────────────────────────────────────────────────────────────┐
│ [Selo Logo]  Acme Corp [prospect] ▾  │  ... rest of header ...   │
└──────────────────────────────────────────────────────────────────┘
```

Dropdown contents:

- List of all organizations with status badges
- "New Organization" option at bottom
- Persists last selected org to localStorage

Component: `components/dashboard/organization-selector.tsx`

### Audit Page URL Input (Internal Users)

Three options:

1. Select existing organization (uses org's website_url)
2. Create new organization (inline dialog)
3. Enter one-time URL (no org created)

```
┌─────────────────────────────────────────┐
│ Select organization or enter URL...  ▼ │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ 🔗 Enter one-time URL...                │
│ ➕ Create new organization...           │
│ ─────────────────────────────────────── │
│ Acme Corp (acme.com) [prospect]         │
│ Beta Inc (beta.io) [customer]           │
└─────────────────────────────────────────┘
```

Component: `components/seo/audit-target-selector.tsx`

### Quick Create Organization Dialog

Triggered from audit page or header selector:

```
┌─────────────────────────────────────┐
│  New Organization                   │
│                                     │
│  Name:     [                  ]     │
│  Website:  [https://          ]     │
│                                     │
│  [Cancel]          [Create & Audit] │
└─────────────────────────────────────┘
```

Creates org with `status = 'prospect'`

Component: `components/dashboard/create-organization-dialog.tsx`

### Convert to Customer Form

On organization detail/settings page:

```
┌─────────────────────────────────────────────────┐
│  Acme Corp                        [PROSPECT]    │
│  acme.com                                       │
│                                                 │
│  ─────────────────────────────────────────────  │
│  Convert to Customer                            │
│                                                 │
│  Industry:        [Select industry...    ▼]    │
│  Contact Email:   [                        ]    │
│                                                 │
│  [Convert to Customer]                          │
└─────────────────────────────────────────────────┘
```

Component: `components/dashboard/convert-organization-form.tsx`

---

## Page Changes

### `/seo/site-audit` and `/seo/page-speed`

- Remove `ProjectSelector` component
- Add `AuditTargetSelector` for internal users
- Show simple "Run Audit" for external users (fixed to their org)
- Update actions to accept `organizationId` (nullable) and `url`

### Header

- For internal users: Show `OrganizationSelector`
- For external users: Show org name (static, current behavior)
- Selector state stored in URL param or context

### Organization Settings Page

- Add conversion form for prospects
- Show status badge
- Allow status change (customer → inactive)

---

## Server Actions

### `lib/organizations/actions.ts`

```typescript
// Create prospect organization (internal only)
createOrganization(name: string, websiteUrl: string): Promise<Organization>

// Convert prospect to customer (internal only)
convertToCustomer(id: string, industry: string, contactEmail: string): Promise<Organization>

// Update organization status (internal only)
updateOrganizationStatus(id: string, status: OrganizationStatus): Promise<Organization>

// Get all organizations (internal sees all, external sees own)
getOrganizations(): Promise<Organization[]>

// Get single organization
getOrganization(id: string): Promise<Organization | null>
```

### Update audit actions

```typescript
// lib/audit/actions.ts
startSiteAudit(organizationId: string | null, url: string): Promise<Audit>

// lib/performance/actions.ts
startPerformanceAudit(organizationId: string | null, urls: string[]): Promise<Audit>
```

---

## Files to Create

| File                                                  | Purpose                           |
| ----------------------------------------------------- | --------------------------------- |
| `components/dashboard/organization-selector.tsx`      | Header org dropdown               |
| `components/dashboard/create-organization-dialog.tsx` | Quick prospect creation           |
| `components/dashboard/convert-organization-form.tsx`  | Prospect → customer               |
| `components/seo/audit-target-selector.tsx`            | Org/URL selection for audits      |
| `lib/organizations/actions.ts`                        | Server actions for org management |

## Files to Modify

| File                                 | Changes                                          |
| ------------------------------------ | ------------------------------------------------ |
| `components/dashboard/header.tsx`    | Add OrganizationSelector for internal users      |
| `app/seo/site-audit/page.tsx`        | Replace ProjectSelector with AuditTargetSelector |
| `app/seo/page-speed/page.tsx`        | Replace ProjectSelector with AuditTargetSelector |
| `lib/audit/actions.ts`               | Accept nullable organizationId                   |
| `lib/performance/actions.ts`         | Accept nullable organizationId                   |
| `app/settings/organization/page.tsx` | Add conversion form                              |

## Files to Remove

| File                                  | Reason                        |
| ------------------------------------- | ----------------------------- |
| `components/seo/project-selector.tsx` | Replaced by org selector      |
| `components/seo/project-dialog.tsx`   | Replaced by create org dialog |
| `lib/seo/actions.ts`                  | Projects no longer exist      |

---

## Migration Strategy

1. **Database migration** (single migration file):
   - Add `is_internal` to users
   - Add `status` and `contact_email` to organizations
   - Drop `project_id` from audit tables
   - Drop `seo_projects` table
   - Update RLS policies

2. **Set existing organizations to customer status**:
   - All current orgs become `status = 'customer'`

3. **Mark internal users**:
   - Manually set `is_internal = true` for Selo employees

---

## Future Enhancements (Out of Scope)

- Search in organization selector dropdown
- Admin panel for managing internal users
- Bulk organization actions
- Organization activity history/timeline
- Audit scheduling per organization

---

## Verification

### Manual Testing

1. Internal user can see all organizations
2. Internal user can create prospect from header
3. Internal user can run audit on one-time URL
4. Internal user can convert prospect to customer
5. External user only sees their organization
6. External user can only audit their own org's URL
7. Last selected org persists across sessions

### Commands

```bash
npm run lint
npm run build
npm run test:unit
```
