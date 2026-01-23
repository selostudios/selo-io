# Multi-Account Integrations Design

## Overview

Allow multiple accounts per platform integration (e.g., company LinkedIn page + founder's personal profile). Users can add integrations via a dialog, customize display names, and view each account's metrics separately on the dashboard.

## Data Model Changes

### `platform_connections` table

**Add columns:**
- `display_name` (TEXT, nullable) - custom label set by user, falls back to `account_name`
- `account_name` (TEXT, not null) - actual name from OAuth (e.g., "Selo Studios", "Jane Smith")

**Constraints:**
- Remove unique constraint on `(organization_id, platform_type)` if exists
- Add unique constraint on `(organization_id, platform_type, account_identifier)` where account_identifier is derived from credentials (LinkedIn: `organization_id`, HubSpot: `hub_id`, GA: `property_id`)

**Migration:**
- Populate `account_name` from existing `credentials->organization_name` (or equivalent)
- Leave `display_name` null (UI falls back to `account_name`)

### `campaign_metrics` table

No changes needed - already scoped by `platform_connection_id` foreign key.

## Add Integration Flow

### UI Components

**Integrations Settings Page (`/settings/integrations`):**
- "+" button in top right header area
- Opens Add Integration dialog

**Add Integration Dialog:**
1. Platform select dropdown (LinkedIn, HubSpot, Google Analytics)
2. "Connect" button - initiates OAuth
3. After OAuth success: shows editable display name field (pre-filled with account name)
4. "Save" button to confirm

### OAuth Callback Changes

1. Receive tokens + account info from OAuth response
2. Extract account identifier (LinkedIn: `organization_id`, HubSpot: `hub_id`, GA: `property_id`)
3. Check if account already connected: match on `organization_id` + `platform_type` + account identifier
4. If duplicate: return error "This account is already connected"
5. If new: create `platform_connection` with `account_name` from OAuth response
6. Redirect to integrations page with success state (triggers confirmation dialog)

**OAuth State Parameter:**
- Pass `action: 'add_new'` in state to distinguish from reconnection flows
- On callback, if state indicates "add new", always create new connection

## Dashboard Display

### Single Account (current behavior preserved)
```
▼ LinkedIn
  [Metrics cards]
  [Charts]
```

### Multiple Accounts
```
▼ LinkedIn
  ┌─────────────────────────────────┐
  │ Selo Studios                    │
  │ [Metrics cards for this account]│
  │ [Charts for this account]       │
  └─────────────────────────────────┘

  ┌─────────────────────────────────┐
  │ Jane Smith                      │
  │ [Metrics cards for this account]│
  │ [Charts for this account]       │
  └─────────────────────────────────┘
```

Account name headers only shown when multiple connections exist for a platform.

## Integrations Settings Page

### Layout
```
LinkedIn
├─ Selo Studios          [Connected] [Edit] [Disconnect]
└─ Jane Smith            [Connected] [Edit] [Disconnect]

HubSpot
└─ Selo Studios          [Connected] [Edit] [Disconnect]

Google Analytics
└─ (Not connected)       [Connect]
```

### Edit Action
- Opens dialog with text field to change display name
- Save updates `display_name` column

### Disconnect Action
- Confirmation: "Disconnect [account name]? This will remove all synced metrics for this account."
- Deletes `platform_connection` and associated `campaign_metrics` records

## Metrics Syncing

### Server Actions
- `getLinkedInMetrics(period, connectionId?)` - optional connectionId parameter
- If connectionId provided: fetch for that specific connection
- If not provided: fetch for all connections of that platform, return array

### Dashboard Sections
- Query all connections for the platform
- Render sub-section per connection (when multiple exist)

### Cron Job
No changes - already iterates over all active `platform_connections`.

## Edge Cases

- **Duplicate account connection:** Show error in dialog
- **OAuth cancelled/failed:** Show error message, stay in dialog
- **Last connection disconnected:** Platform shows "Not connected" state with Connect option
