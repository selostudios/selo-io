# TypeScript Enum Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert all string literal union types to TypeScript enums for better type safety, autocomplete, and refactoring support.

**Architecture:** Create a centralized `lib/enums.ts` file containing all shared enums. Update type definitions to use enums and replace all string comparisons with enum references. Maintain backward compatibility with database string values.

**Tech Stack:** TypeScript enums, existing type system

---

## Overview

This refactoring converts ~60+ string literal comparisons across the codebase to type-safe enum references. TypeScript enums provide:
- IDE autocomplete and refactoring support
- Single source of truth for valid values
- Compile-time type checking
- Clear semantics (enum vs magic string)

**Important:** TypeScript string enums serialize to their string values in JSON, making them compatible with existing database columns without migration.

---

## Task 1: Create Centralized Enums File

**Files:**
- Create: `lib/enums.ts`

**Step 1: Create the enums file with all shared enums**

```typescript
/**
 * Centralized TypeScript enums for type-safe string comparisons.
 *
 * These enums replace string literal union types throughout the codebase.
 * String enums serialize to their values in JSON, maintaining database compatibility.
 */

// =============================================================================
// Audit Enums
// =============================================================================

export enum AuditStatus {
  Pending = 'pending',
  Crawling = 'crawling',
  BatchComplete = 'batch_complete',
  Checking = 'checking',
  Completed = 'completed',
  Failed = 'failed',
  Stopped = 'stopped',
}

export enum CheckType {
  SEO = 'seo',
  AIReadiness = 'ai_readiness',
  Technical = 'technical',
}

export enum CheckPriority {
  Critical = 'critical',
  Recommended = 'recommended',
  Optional = 'optional',
}

export enum CheckStatus {
  Passed = 'passed',
  Failed = 'failed',
  Warning = 'warning',
}

// =============================================================================
// Performance Audit Enums
// =============================================================================

export enum PerformanceAuditStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Stopped = 'stopped',
}

export enum CWVRating {
  Good = 'good',
  NeedsImprovement = 'needs_improvement',
  Poor = 'poor',
}

export enum DeviceType {
  Mobile = 'mobile',
  Desktop = 'desktop',
}

// =============================================================================
// AIO Audit Enums
// =============================================================================

export enum AIOAuditStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export enum AIOCheckCategory {
  TechnicalFoundation = 'technical_foundation',
  ContentStructure = 'content_structure',
  ContentQuality = 'content_quality',
}

// =============================================================================
// Organization Enums
// =============================================================================

export enum OrganizationStatus {
  Prospect = 'prospect',
  Customer = 'customer',
  Inactive = 'inactive',
}

// =============================================================================
// User & Permissions Enums
// =============================================================================

export enum UserRole {
  Admin = 'admin',
  Developer = 'developer',
  TeamMember = 'team_member',
  ClientViewer = 'client_viewer',
}

// =============================================================================
// Campaign Enums
// =============================================================================

export enum CampaignStatus {
  Draft = 'draft',
  Active = 'active',
  Disabled = 'disabled',
  Completed = 'completed',
}

// =============================================================================
// Feedback Enums
// =============================================================================

export enum FeedbackCategory {
  Bug = 'bug',
  FeatureRequest = 'feature_request',
  Performance = 'performance',
  Usability = 'usability',
  Other = 'other',
}

export enum FeedbackStatus {
  New = 'new',
  UnderReview = 'under_review',
  InProgress = 'in_progress',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum FeedbackPriority {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

// =============================================================================
// Date/Period Enums
// =============================================================================

export enum Period {
  SevenDays = '7d',
  ThirtyDays = '30d',
  Quarter = 'quarter',
}

// =============================================================================
// Google Analytics Enums
// =============================================================================

export enum GAChannel {
  Direct = 'direct',
  OrganicSearch = 'organic search',
  Email = 'email',
  OrganicSocial = 'organic social',
  Referral = 'referral',
}

// =============================================================================
// Brandfetch Enums
// =============================================================================

export enum LogoType {
  Logo = 'logo',
  Icon = 'icon',
  Symbol = 'symbol',
}

export enum ImageFormat {
  SVG = 'svg',
  PNG = 'png',
  JPG = 'jpg',
}
```

**Step 2: Run TypeScript to verify no syntax errors**

Run: `npx tsc lib/enums.ts --noEmit`
Expected: No output (success)

**Step 3: Commit**

```bash
git add lib/enums.ts
git commit -m "feat: add centralized TypeScript enums"
```

---

## Task 2: Update Audit Types to Use Enums

**Files:**
- Modify: `lib/audit/types.ts`

**Step 1: Update imports and type definitions**

Replace the string literal types with enum imports:

```typescript
import {
  AuditStatus,
  CheckType,
  CheckPriority,
  CheckStatus,
} from '@/lib/enums'

// Re-export enums for convenience
export { AuditStatus, CheckType, CheckPriority, CheckStatus }

// Remove these lines (they're now enums):
// export type AuditStatus = 'pending' | 'crawling' | ...
// export type CheckType = 'seo' | 'ai_readiness' | 'technical'
// export type CheckPriority = 'critical' | 'recommended' | 'optional'
// export type CheckStatus = 'passed' | 'failed' | 'warning'
```

The interfaces that use these types (SiteAudit, SiteAuditCheck, etc.) will automatically work because TypeScript enums are compatible with their string values.

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: May show errors in files that compare against strings - these will be fixed in subsequent tasks

**Step 3: Commit**

```bash
git add lib/audit/types.ts
git commit -m "refactor: use enums in audit types"
```

---

## Task 3: Update Audit Runner String Comparisons

**Files:**
- Modify: `lib/audit/runner.ts`
- Modify: `lib/audit/batch-crawler.ts`

**Step 1: Update imports in runner.ts**

Add enum imports at the top:

```typescript
import { AuditStatus, CheckStatus } from '@/lib/enums'
```

**Step 2: Replace string comparisons in runner.ts**

Find and replace:
- `status === 'stopped'` → `status === AuditStatus.Stopped`
- `status === 'completed'` → `status === AuditStatus.Completed`
- `check.status === 'passed'` → `check.status === CheckStatus.Passed`
- `check.status === 'warning'` → `check.status === CheckStatus.Warning`
- `check.status === 'failed'` → `check.status === CheckStatus.Failed`

**Step 3: Update imports in batch-crawler.ts**

```typescript
import { AuditStatus } from '@/lib/enums'
```

**Step 4: Replace string comparisons in batch-crawler.ts**

- `auditStatus?.status === 'stopped'` → `auditStatus?.status === AuditStatus.Stopped`

**Step 5: Run tests**

Run: `npm run test:unit -- tests/unit/lib/audit`
Expected: All tests pass

**Step 6: Commit**

```bash
git add lib/audit/runner.ts lib/audit/batch-crawler.ts
git commit -m "refactor: use AuditStatus and CheckStatus enums in audit runner"
```

---

## Task 4: Update Audit PDF and Summary

**Files:**
- Modify: `lib/audit/pdf.tsx`
- Modify: `lib/audit/summary.ts`
- Modify: `lib/pdf/components.tsx`

**Step 1: Update imports in pdf.tsx**

```typescript
import { CheckPriority, CheckStatus } from '@/lib/enums'
```

**Step 2: Replace string comparisons in pdf.tsx**

- `check.status === 'passed'` → `check.status === CheckStatus.Passed`
- `c.priority === 'critical'` → `c.priority === CheckPriority.Critical`
- `c.status === 'failed'` → `c.status === CheckStatus.Failed`

**Step 3: Update imports in summary.ts**

```typescript
import { CheckPriority, CheckStatus } from '@/lib/enums'
```

**Step 4: Replace string comparisons in summary.ts**

- `c.priority === 'critical'` → `c.priority === CheckPriority.Critical`
- `c.priority === 'recommended'` → `c.priority === CheckPriority.Recommended`
- `c.status === 'failed'` → `c.status === CheckStatus.Failed`
- `c.status === 'warning'` → `c.status === CheckStatus.Warning`
- `c.status === 'passed'` → `c.status === CheckStatus.Passed`

**Step 5: Update imports in lib/pdf/components.tsx**

```typescript
import { CheckPriority } from '@/lib/enums'
```

**Step 6: Replace string comparisons in components.tsx**

- `priority === 'critical'` → `priority === CheckPriority.Critical`
- `priority === 'recommended'` → `priority === CheckPriority.Recommended`

**Step 7: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 8: Commit**

```bash
git add lib/audit/pdf.tsx lib/audit/summary.ts lib/pdf/components.tsx
git commit -m "refactor: use CheckPriority and CheckStatus enums in PDF/summary"
```

---

## Task 5: Update Performance Types and Runner

**Files:**
- Modify: `lib/performance/types.ts`
- Modify: `lib/performance/runner.ts`
- Modify: `lib/performance/pdf.tsx`

**Step 1: Update performance/types.ts**

```typescript
import {
  PerformanceAuditStatus,
  CWVRating,
  DeviceType,
} from '@/lib/enums'

// Re-export for convenience
export { PerformanceAuditStatus, CWVRating, DeviceType }

// Remove these lines:
// export type PerformanceAuditStatus = 'pending' | 'running' | ...
// export type CWVRating = 'good' | 'needs_improvement' | 'poor'
// export type DeviceType = 'mobile' | 'desktop'
```

**Step 2: Update performance/runner.ts**

```typescript
import { PerformanceAuditStatus } from '@/lib/enums'
```

Replace:
- `status === 'stopped'` → `status === PerformanceAuditStatus.Stopped`

**Step 3: Update performance/pdf.tsx**

```typescript
import { DeviceType } from '@/lib/enums'
```

Replace:
- `r.device === 'mobile'` → `r.device === DeviceType.Mobile`
- `r.device === 'desktop'` → `r.device === DeviceType.Desktop`

**Step 4: Run tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/performance/types.ts lib/performance/runner.ts lib/performance/pdf.tsx
git commit -m "refactor: use PerformanceAuditStatus and DeviceType enums"
```

---

## Task 6: Update AIO Types and Runner

**Files:**
- Modify: `lib/aio/types.ts`
- Modify: `lib/aio/runner.ts`

**Step 1: Update aio/types.ts**

```typescript
import {
  AIOAuditStatus,
  AIOCheckCategory,
  CheckPriority,
  CheckStatus,
} from '@/lib/enums'

// Re-export and create alias for AIO-specific priority
export { AIOAuditStatus, AIOCheckCategory, CheckStatus }
export { CheckPriority as AIOCheckPriority }

// Remove these lines:
// export type AIOAuditStatus = 'pending' | 'running' | ...
// export type AIOCheckCategory = 'technical_foundation' | ...
// export type AIOCheckPriority = 'critical' | 'recommended' | 'optional'
// export type CheckStatus = 'passed' | 'failed' | 'warning'
```

**Step 2: Update aio/runner.ts**

```typescript
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
```

Replace:
- `check.priority === 'critical'` → `check.priority === CheckPriority.Critical`
- `check.priority === 'recommended'` → `check.priority === CheckPriority.Recommended`
- `check.status === 'passed'` → `check.status === CheckStatus.Passed`
- `check.status === 'warning'` → `check.status === CheckStatus.Warning`
- `c.category === 'technical_foundation'` → `c.category === AIOCheckCategory.TechnicalFoundation`
- `c.category === 'content_structure'` → `c.category === AIOCheckCategory.ContentStructure`
- `c.category === 'content_quality'` → `c.category === AIOCheckCategory.ContentQuality`

**Step 3: Run tests**

Run: `npm run test:unit -- tests/unit/lib/aio`
Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/aio/types.ts lib/aio/runner.ts
git commit -m "refactor: use AIO enums in types and runner"
```

---

## Task 7: Update Organization Types

**Files:**
- Modify: `lib/organizations/types.ts`
- Modify: `app/(authenticated)/organizations/client.tsx`

**Step 1: Update organizations/types.ts**

```typescript
import { OrganizationStatus } from '@/lib/enums'

export { OrganizationStatus }

// Remove: export type OrganizationStatus = 'prospect' | 'customer' | 'inactive'
```

**Step 2: Update organizations/client.tsx**

```typescript
import { OrganizationStatus } from '@/lib/enums'
```

Replace:
- `o.status === 'prospect'` → `o.status === OrganizationStatus.Prospect`
- `o.status === 'customer'` → `o.status === OrganizationStatus.Customer`
- `o.status === 'inactive'` → `o.status === OrganizationStatus.Inactive`

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/organizations/types.ts app/\(authenticated\)/organizations/client.tsx
git commit -m "refactor: use OrganizationStatus enum"
```

---

## Task 8: Update Permissions with UserRole Enum

**Files:**
- Modify: `lib/permissions.ts`

**Step 1: Update permissions.ts**

```typescript
import { UserRole } from '@/lib/enums'

export { UserRole }

// Remove: export type UserRole = 'admin' | 'developer' | 'team_member' | 'client_viewer'

// Update ROLE_PERMISSIONS to use enum keys:
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.Admin]: [
    'org:update',
    'org:view',
    // ... rest of permissions
  ],
  [UserRole.Developer]: ['org:update', 'org:view', 'team:view', 'feedback:manage'],
  [UserRole.TeamMember]: [
    'org:view',
    'team:view',
    'campaigns:create',
    'campaigns:update',
    'campaigns:delete',
  ],
  [UserRole.ClientViewer]: ['org:view', 'team:view'],
}
```

**Step 2: Update canAccessAllAudits function**

Replace:
- `userRecord.role === 'admin'` → `userRecord.role === UserRole.Admin`
- `userRecord.role === 'developer'` → `userRecord.role === UserRole.Developer`

**Step 3: Run tests**

Run: `npm run test:unit -- tests/unit/lib/permissions`
Expected: All tests pass (if any exist)

**Step 4: Commit**

```bash
git add lib/permissions.ts
git commit -m "refactor: use UserRole enum in permissions"
```

---

## Task 9: Update Campaign Status

**Files:**
- Modify: `lib/utils.ts`

**Step 1: Update utils.ts**

Replace the const object pattern with enum import:

```typescript
import { CampaignStatus } from '@/lib/enums'

export { CampaignStatus }

// Remove these lines:
// export const CampaignStatus = {
//   DRAFT: 'draft',
//   ACTIVE: 'active',
//   DISABLED: 'disabled',
//   COMPLETED: 'completed',
// } as const
// export type CampaignStatusType = (typeof CampaignStatus)[keyof typeof CampaignStatus]
```

**Step 2: Search and update any usages**

Find files using `CampaignStatus.DRAFT` etc. and update to `CampaignStatus.Draft` (enum naming convention).

Run: `grep -r "CampaignStatus\." --include="*.ts" --include="*.tsx" lib app components`

Update any found usages.

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/utils.ts
git commit -m "refactor: use CampaignStatus enum instead of const object"
```

---

## Task 10: Update Feedback Types

**Files:**
- Modify: `lib/types/feedback.ts`

**Step 1: Update feedback.ts**

```typescript
import { FeedbackCategory, FeedbackStatus, FeedbackPriority } from '@/lib/enums'

export { FeedbackCategory, FeedbackStatus, FeedbackPriority }

// Remove these lines:
// export type FeedbackCategory = 'bug' | 'feature_request' | ...
// export type FeedbackStatus = 'new' | 'under_review' | ...
// export type FeedbackPriority = 'critical' | 'high' | ...

// Update the Record types to use enum:
export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  [FeedbackCategory.Bug]: 'Bug',
  [FeedbackCategory.FeatureRequest]: 'Feature Request',
  [FeedbackCategory.Performance]: 'Performance',
  [FeedbackCategory.Usability]: 'Usability',
  [FeedbackCategory.Other]: 'Other',
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  [FeedbackStatus.New]: 'New',
  [FeedbackStatus.UnderReview]: 'Under Review',
  [FeedbackStatus.InProgress]: 'In Progress',
  [FeedbackStatus.Resolved]: 'Resolved',
  [FeedbackStatus.Closed]: 'Closed',
}

// ... similarly update PRIORITY_LABELS, STATUS_COLORS, CATEGORY_COLORS, PRIORITY_COLORS

export const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: FeedbackCategory.Bug, label: 'Bug' },
  { value: FeedbackCategory.FeatureRequest, label: 'Feature Request' },
  { value: FeedbackCategory.Performance, label: 'Performance' },
  { value: FeedbackCategory.Usability, label: 'Usability' },
  { value: FeedbackCategory.Other, label: 'Other' },
]

// ... similarly update STATUS_OPTIONS, PRIORITY_OPTIONS
```

**Step 2: Run tests**

Run: `npm run test:unit -- tests/unit/lib/types/feedback`
Expected: All tests pass

**Step 3: Commit**

```bash
git add lib/types/feedback.ts
git commit -m "refactor: use Feedback enums in types"
```

---

## Task 11: Update Period Type and Date Ranges

**Files:**
- Modify: `lib/metrics/types.ts`
- Modify: `lib/utils/date-ranges.ts`
- Modify: `lib/metrics/format.ts`

**Step 1: Update metrics/types.ts**

```typescript
import { Period } from '@/lib/enums'

export { Period }

// Remove: export type Period = '7d' | '30d' | 'quarter'
```

**Step 2: Update date-ranges.ts**

```typescript
import { Period } from '@/lib/enums'

// Remove: export type DateRangePeriod = '7d' | '30d' | 'quarter'
// Use Period instead of DateRangePeriod throughout

export function getDateRange(period: Period): DateRange {
  // ...
  if (period === Period.SevenDays) {
    // ...
  }
  if (period === Period.ThirtyDays) {
    // ...
  }
  // Quarter case is the else
}

export function getPreviousPeriodRange(
  currentRange: DateRange,
  period: Period
): DateRange {
  if (period === Period.Quarter) {
    // ...
  }
  // ...
}
```

**Step 3: Update metrics/format.ts**

```typescript
import { Period } from '@/lib/enums'

export function getPeriodLabel(period: Period): string {
  switch (period) {
    case Period.SevenDays:
      return 'Last 7 days'
    case Period.ThirtyDays:
      return 'Last 30 days'
    case Period.Quarter:
      return 'This quarter'
  }
}
```

**Step 4: Run tests**

Run: `npm run test:unit -- tests/unit/lib/utils/date-ranges`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/metrics/types.ts lib/utils/date-ranges.ts lib/metrics/format.ts
git commit -m "refactor: use Period enum in metrics and date ranges"
```

---

## Task 12: Update Google Analytics Channel Comparisons

**Files:**
- Modify: `lib/platforms/google-analytics/client.ts`

**Step 1: Add enum import**

```typescript
import { GAChannel } from '@/lib/enums'
```

**Step 2: Replace channel comparisons**

In both `getMetrics` and `fetchDailyMetrics` methods, replace:

```typescript
// Before:
if (channel === 'direct') {
  metrics.trafficAcquisition.direct = sessions
} else if (channel === 'organic search') {
  metrics.trafficAcquisition.organicSearch = sessions
}
// ...

// After:
if (channel === GAChannel.Direct) {
  metrics.trafficAcquisition.direct = sessions
} else if (channel === GAChannel.OrganicSearch) {
  metrics.trafficAcquisition.organicSearch = sessions
} else if (channel === GAChannel.Email) {
  metrics.trafficAcquisition.email = sessions
} else if (channel === GAChannel.OrganicSocial) {
  metrics.trafficAcquisition.organicSocial = sessions
} else if (channel === GAChannel.Referral) {
  metrics.trafficAcquisition.referral = sessions
}
```

**Step 3: Run tests**

Run: `npm run test:unit -- tests/unit/lib/platforms`
Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/platforms/google-analytics/client.ts
git commit -m "refactor: use GAChannel enum in Google Analytics client"
```

---

## Task 13: Update Brandfetch Client

**Files:**
- Modify: `lib/brandfetch/client.ts`

**Step 1: Add enum import**

```typescript
import { LogoType, ImageFormat } from '@/lib/enums'
```

**Step 2: Replace comparisons in selectBestLogo**

```typescript
const typeScore = (logo: typeof a) => {
  if (logo.type === LogoType.Logo) return 3
  if (logo.type === LogoType.Icon) return 2
  if (logo.type === LogoType.Symbol) return 1
  return 0
}

const formatScore = (f: typeof a) => {
  if (f.format === ImageFormat.SVG) return 3
  if (f.format === ImageFormat.PNG) return 2
  return 1
}
```

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/brandfetch/client.ts
git commit -m "refactor: use LogoType and ImageFormat enums in Brandfetch"
```

---

## Task 14: Update UI Components with Enum Comparisons

**Files:**
- Modify: `components/audit/check-list.tsx`
- Modify: `components/audit/audit-report.tsx`
- Modify: `components/performance/performance-live-progress.tsx`
- Modify: `components/performance/performance-audit-page.tsx`
- Modify: `hooks/use-audit-polling.ts`
- Modify: `hooks/use-aio-audit-polling.ts`

**Step 1: Update check-list.tsx**

```typescript
import { CheckStatus } from '@/lib/enums'
```

Replace all `c.status === 'failed'`, `'warning'`, `'passed'` with enum references.

**Step 2: Update audit-report.tsx**

```typescript
import { CheckStatus } from '@/lib/enums'
```

Replace status comparisons.

**Step 3: Update performance-live-progress.tsx**

```typescript
import { PerformanceAuditStatus } from '@/lib/enums'
```

Replace:
- `progress?.status === 'failed'` → `progress?.status === PerformanceAuditStatus.Failed`
- `progress?.status === 'stopped'` → `progress?.status === PerformanceAuditStatus.Stopped`
- `progress?.status === 'pending'` → `progress?.status === PerformanceAuditStatus.Pending`

**Step 4: Update performance-audit-page.tsx**

```typescript
import { PerformanceAuditStatus } from '@/lib/enums'
```

Replace status comparisons.

**Step 5: Update hooks/use-audit-polling.ts**

```typescript
import { AuditStatus } from '@/lib/enums'
```

Replace:
- `data.status === 'batch_complete'` → `data.status === AuditStatus.BatchComplete`
- `data.status === 'pending'` → `data.status === AuditStatus.Pending`
- `data.status === 'crawling'` → `data.status === AuditStatus.Crawling`
- `data.status === 'checking'` → `data.status === AuditStatus.Checking`

**Step 6: Update hooks/use-aio-audit-polling.ts**

```typescript
import { AIOAuditStatus } from '@/lib/enums'
```

Replace:
- `data.audit?.status === 'completed'` → `data.audit?.status === AIOAuditStatus.Completed`
- `data.audit?.status === 'failed'` → `data.audit?.status === AIOAuditStatus.Failed`

**Step 7: Run lint and build**

Run: `npm run lint && npm run build`
Expected: No errors

**Step 8: Commit**

```bash
git add components/audit/check-list.tsx components/audit/audit-report.tsx \
  components/performance/performance-live-progress.tsx components/performance/performance-audit-page.tsx \
  hooks/use-audit-polling.ts hooks/use-aio-audit-polling.ts
git commit -m "refactor: use enums in UI components and hooks"
```

---

## Task 15: Update Dashboard Platform Sections

**Files:**
- Modify: `components/dashboard/integrations-panel.tsx` (if Period type used)
- Modify: `components/dashboard/platform-section/types.ts`

**Step 1: Update platform-section/types.ts**

If Period is imported from metrics/types.ts, ensure it now comes from the enum:

```typescript
import { Period } from '@/lib/enums'
// or
import { Period } from '@/lib/metrics/types' // which re-exports from enums
```

**Step 2: Check integrations-panel.tsx**

Ensure Period type is correctly imported.

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add components/dashboard/platform-section/types.ts components/dashboard/integrations-panel.tsx
git commit -m "refactor: ensure Period enum used in dashboard components"
```

---

## Task 16: Run Full Test Suite and Verify Build

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 2: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any remaining fixes**

If any tests needed updates, commit them:

```bash
git add -A
git commit -m "test: update tests for enum refactoring"
```

---

## Summary

After completing all tasks:

- **New file:** `lib/enums.ts` - centralized enum definitions
- **Updated type files:** 7 files converted from string literals to enum imports
- **Updated comparison sites:** ~60+ string comparisons converted to enum references
- **Benefits achieved:**
  - IDE autocomplete for all status/type values
  - Compile-time type checking
  - Single source of truth for valid values
  - Easy refactoring (rename in one place)
  - Clear semantics in code reviews
