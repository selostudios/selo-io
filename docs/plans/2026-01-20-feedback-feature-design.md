# Feedback Feature Design

## Overview

A platform-wide feedback system that allows users to report issues, request features, and suggest improvements. Developers can triage and manage feedback through a dedicated Support section.

## Core Components

### 1. User Feedback Submission

**Access Points:**

- User menu dropdown: "Report an Issue" menu item
- Keyboard shortcut: CMD+Shift+F (global, all authenticated pages)

**Form Fields:**

- Title (text, required)
- Description (textarea, required)
- Category (select, required): Bug, Feature Request, Performance, Usability, Other
- Screenshot (file upload, optional, images only)

**Auto-Captured Context:**

- Current page URL
- Organization ID (which org they were viewing)
- Browser/device info (user agent)

### 2. Support Section (Developer Only)

**Route:** `/support`

**Access:** Restricted to users with `developer` role. Non-developers redirected to `/dashboard`.

**List View:**

- Filterable table with columns: Title, Category, Status, Priority, Submitted By, Org, Date
- Filter dropdowns: Status, Category, Priority
- Sortable columns (default: newest first)

**Slide-over Panel:**

- Opens on row click (or via URL param `?issue={id}`)
- Shows full feedback details including screenshot
- Editable: Status, Priority, Note
- Save triggers user notification if status changed

### 3. Developer Role

**Definition:** A new platform-level role with SUDO-like access.

**Capabilities:**

- Bypasses organization-scoped RLS policies
- Can view/access any organization's data
- Exclusive access to Support section

**Future:** Will have access to a global sidebar with Organizations list, Support, and platform settings.

---

## Data Model

### Enums

```sql
-- Add to existing user_role enum
ALTER TYPE user_role ADD VALUE 'developer';

-- New enums for feedback
CREATE TYPE feedback_category AS ENUM (
  'bug',
  'feature_request',
  'performance',
  'usability',
  'other'
);

CREATE TYPE feedback_status AS ENUM (
  'new',
  'under_review',
  'in_progress',
  'resolved',
  'closed'
);

CREATE TYPE feedback_priority AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);
```

### Feedback Table

```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category feedback_category NOT NULL,
  status feedback_status NOT NULL DEFAULT 'new',
  priority feedback_priority,
  submitted_by UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  page_url TEXT,
  user_agent TEXT,
  screenshot_url TEXT,
  status_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS Policies

```sql
-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (submitted_by = auth.uid());

-- Users can submit feedback
CREATE POLICY "Users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Developers can view all feedback
CREATE POLICY "Developers can view all feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- Developers can update feedback
CREATE POLICY "Developers can update feedback"
  ON feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- No delete policy - maintain audit trail
```

### Update Existing RLS Policies

Add developer bypass to existing org-scoped policies:

```sql
-- Example pattern for existing policies
CREATE POLICY "policy_name" ON table_name
  FOR SELECT USING (
    organization_id = current_user_org_id()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );
```

### Supabase Storage

**Bucket:** `feedback-screenshots`

**Policies:**

- Authenticated users can upload to their own path
- Users can read their own uploads
- Developers can read all uploads

---

## Email Notifications

### 1. New Feedback Submitted (to developers)

**Trigger:** Feedback record inserted

**Recipients:** All users with `role = 'developer'`

**Subject:** `[Selo] New Issue Reported: {title}`

**Content:**

- Category badge
- Title and description (preview, ~200 chars)
- Submitted by: name + email
- Organization name
- Page URL
- CTA: "View in Support" → `/support?issue={id}`

### 2. Status Changed (to submitter)

**Trigger:** Feedback status updated

**Recipient:** User who submitted the feedback

**Subject:** `[Selo] Your issue has been updated: {title}`

**Content:**

- Feedback title
- Status change (e.g., "New → Under Review")
- Developer's note (if provided)
- No link (informational only)

**Future:** Add comments for ongoing dialog between developer and user.

---

## File Structure

### New Files

```
app/
  support/
    layout.tsx              # Developer-only access check
    page.tsx                # Support list view
    actions.ts              # Server actions

components/
  feedback/
    feedback-dialog.tsx     # Submission form dialog
    feedback-trigger.tsx    # CMD+Shift+F listener
    feedback-provider.tsx   # Context provider
  support/
    support-table.tsx       # Filterable table
    support-filters.tsx     # Filter dropdowns
    support-slideout.tsx    # Detail slide-over panel

emails/
  feedback-submitted-email.tsx
  feedback-status-email.tsx

supabase/
  migrations/
    XXXXXX_feedback_feature.sql
```

### Modified Files

- `components/dashboard/user-menu.tsx` - Add "Report an Issue" item
- `app/dashboard/layout.tsx` - Mount keyboard shortcut listener
- Existing RLS policies - Add developer bypass conditions

---

## UI Specifications

### Feedback Dialog

- Opens as modal dialog (consistent with existing patterns)
- Form validation: title and description required
- Category defaults to first option (Bug)
- Screenshot upload: drag-drop zone, image preview, remove button
- Submit: shows loading state, closes on success with toast

### Support Table

| Column       | Width | Sortable | Notes                     |
| ------------ | ----- | -------- | ------------------------- |
| Title        | flex  | Yes      | Truncate with ellipsis    |
| Category     | 120px | Yes      | Badge style               |
| Status       | 120px | Yes      | Badge with color          |
| Priority     | 100px | Yes      | Badge, dim if unset       |
| Submitted By | 150px | Yes      | User name                 |
| Organization | 150px | Yes      | Org name                  |
| Date         | 100px | Yes      | Relative (e.g., "2h ago") |

### Support Slide-over

- Width: 480px
- Sections: Details, Context, Actions
- Status/Priority: dropdown selects
- Note: textarea, placeholder "Add a note about this change..."
- Save button: disabled until changes made

---

## Status Definitions

| Status       | Description                            | Color  |
| ------------ | -------------------------------------- | ------ |
| New          | Just submitted, not reviewed           | Gray   |
| Under Review | Developer is investigating             | Blue   |
| In Progress  | Actively being worked on               | Yellow |
| Resolved     | Fixed or implemented                   | Green  |
| Closed       | Won't fix / duplicate / not actionable | Red    |

## Priority Definitions

| Priority | Description                          | Color  |
| -------- | ------------------------------------ | ------ |
| Critical | System breaking, immediate attention | Red    |
| High     | Significant issue, prioritize soon   | Orange |
| Medium   | Normal priority                      | Yellow |
| Low      | Nice to have, when time permits      | Gray   |

---

## Testing Strategy

Following the project's testing distribution: 60% unit, 30% integration, 10% E2E.

### Unit Tests (Vitest + Testing Library)

**Location:** `tests/unit/feedback/`

**Components:**

| Test File                    | Coverage                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `feedback-dialog.test.tsx`   | Form rendering, validation, category selection, screenshot preview, submit button states |
| `feedback-trigger.test.tsx`  | Keyboard shortcut detection (CMD+Shift+F), dialog open trigger                           |
| `feedback-provider.test.tsx` | Context value, open/close state management                                               |
| `support-table.test.tsx`     | Column rendering, sorting behavior, row click handler                                    |
| `support-filters.test.tsx`   | Filter dropdowns, selected state, clear filters                                          |
| `support-slideout.test.tsx`  | Detail display, form fields, save button disabled state                                  |

**Utilities:**

| Test File                | Coverage                                                 |
| ------------------------ | -------------------------------------------------------- |
| `feedback-utils.test.ts` | Category/status/priority label formatting, color mapping |

**Email Templates:**

| Test File                  | Coverage                                                  |
| -------------------------- | --------------------------------------------------------- |
| `feedback-emails.test.tsx` | Email renders with correct props, subject line formatting |

### Integration Tests (Vitest + Local Supabase)

**Location:** `tests/integration/feedback/`

| Test File                  | Coverage                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `feedback-actions.test.ts` | `submitFeedback` action: inserts record, uploads screenshot, sends dev notification        |
| `feedback-actions.test.ts` | `updateFeedbackStatus` action: updates record, sends user notification when status changes |
| `feedback-rls.test.ts`     | Users can only read own feedback, developers can read/update all                           |
| `feedback-rls.test.ts`     | Users cannot delete feedback (no delete policy)                                            |
| `feedback-rls.test.ts`     | Non-authenticated users cannot submit feedback                                             |
| `developer-role.test.ts`   | Developer role bypasses org-scoped RLS on existing tables                                  |
| `developer-role.test.ts`   | Developer can access data from any organization                                            |
| `storage-policies.test.ts` | Screenshot upload permissions, read access rules                                           |

### E2E Tests (Playwright)

**Location:** `tests/e2e/feedback/`

| Test File                     | User Journey                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `submit-feedback.spec.ts`     | User opens feedback dialog via menu → fills form → uploads screenshot → submits → sees success toast     |
| `submit-feedback.spec.ts`     | User opens feedback dialog via CMD+Shift+F → submits minimal feedback (no screenshot)                    |
| `support-section.spec.ts`     | Developer navigates to /support → sees feedback list → filters by status → clicks row → slide-over opens |
| `support-section.spec.ts`     | Developer updates status with note → saves → record updates                                              |
| `support-access.spec.ts`      | Non-developer tries to access /support → redirected to /dashboard                                        |
| `email-notifications.spec.ts` | Feedback submitted → developer receives email (check Mailpit)                                            |
| `email-notifications.spec.ts` | Status changed → submitter receives email with note (check Mailpit)                                      |

### Test Data Requirements

**Seed data for E2E (`tests/helpers/seed.ts`):**

```typescript
// Add to existing seed
const feedbackSeeds = {
  // Test user who submits feedback
  regularUser: { role: 'team_member', org: 'test-org' },

  // Developer user for support section
  developerUser: { role: 'developer' },

  // Sample feedback items in various states
  feedbackItems: [
    { status: 'new', category: 'bug', priority: null },
    { status: 'under_review', category: 'feature_request', priority: 'high' },
    { status: 'resolved', category: 'performance', priority: 'medium' },
  ],
}
```

### Test Coverage Goals

| Area                     | Target | Notes                             |
| ------------------------ | ------ | --------------------------------- |
| Feedback submission flow | 90%    | Critical user path                |
| Support section CRUD     | 85%    | Developer workflow                |
| RLS policies             | 100%   | Security critical                 |
| Email notifications      | 80%    | Integration with external service |
| Keyboard shortcut        | 70%    | Browser-specific behavior         |

---

## Future Scope (Not in Initial Build)

- Two-tier navigation (global sidebar + org sidebar)
- Organization switcher for developers
- Comments on feedback items for ongoing dialog
- Feedback status page for users (`/feedback/[id]`)
- Bulk actions in Support table
- Export feedback to CSV
- Feedback analytics/dashboard
