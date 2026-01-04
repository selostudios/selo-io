# LinkedIn Integration Design

**Date:** January 3, 2026
**Status:** Design Approved

## Overview

Add LinkedIn organization page metrics to the main dashboard, showing key performance indicators with period-over-period comparison.

## Metrics

| Metric | Description | LinkedIn API |
|--------|-------------|--------------|
| New Followers | Followers gained in period | `organizationalEntityFollowerStatistics` |
| Page Views | Company page views | `organizationPageStatistics` |
| Unique Visitors | Unique page visitors | `organizationPageStatistics` |
| Impressions | Post impressions | `organizationalEntityShareStatistics` |
| Reactions | Total reactions on posts | `organizationalEntityShareStatistics` |

## Scope

- **Organization-level only** - Not tied to specific campaigns
- **Display location** - Main dashboard in a "LinkedIn" section

## Authentication

Manual token entry (MVP approach):

- **Organization ID** - LinkedIn company page ID (numeric)
- **Access Token** - OAuth 2.0 token with scopes:
  - `r_organization_social` - Read organization posts and engagement
  - `r_organization_admin` - Read organization page stats

## Time Ranges

User-selectable with dropdown:

| Option | Current Period | Comparison Period |
|--------|---------------|-------------------|
| 7 days (default) | Last 7 days | Previous 7 days |
| 30 days | Last 30 days | Previous 30 days |
| This quarter | Current calendar quarter | Previous calendar quarter |

Calendar quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)

## UI Design

### Dashboard Section

```
┌─────────────────────────────────────────────────────────────┐
│ LinkedIn                            [7 days ▼] [↻ Refresh]  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │   220    │ │   507    │ │   239    │ │  2,976   │ │    53    │
│  │ Followers│ │Page views│ │ Visitors │ │Impressions│ │Reactions │
│  │ ▲746.2%  │ │ ▲35.6%   │ │ ▲50.3%   │ │ ▲13.5%   │ │ ▼35.4%   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
└─────────────────────────────────────────────────────────────┘
```

### Metric Card Component

- Large bold number (formatted with commas)
- Gray label below
- Percentage change with triangle indicator:
  - Green ▲ for positive change
  - Red ▼ for negative change

## Data Model

### Database Changes

Add `organization_id` to `campaign_metrics` to support org-level metrics:

```sql
ALTER TABLE campaign_metrics
ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Make campaign_id nullable for org-level metrics
ALTER TABLE campaign_metrics
ALTER COLUMN campaign_id DROP NOT NULL;
```

### Metric Storage

Daily snapshots in `campaign_metrics`:

| Column | Value |
|--------|-------|
| organization_id | Organization UUID |
| campaign_id | NULL (org-level) |
| platform_type | 'linkedin' |
| date | Date of metric |
| metric_type | See below |
| value | Numeric value |

Metric types:
- `linkedin_followers`
- `linkedin_page_views`
- `linkedin_unique_visitors`
- `linkedin_impressions`
- `linkedin_reactions`

## Adapter Architecture

```
lib/platforms/linkedin/
├── client.ts        # API client with auth headers
├── adapter.ts       # Main adapter - fetches & normalizes data
└── types.ts         # LinkedIn-specific response types
```

### Adapter Flow

1. Load credentials from `platform_connections`
2. Call LinkedIn APIs for each metric type
3. Normalize responses to daily values
4. Upsert into `campaign_metrics` table
5. Update `last_sync_at` on the connection

### Error Handling

- Token expired: Show "Reconnect LinkedIn" prompt
- Rate limited: Retry with exponential backoff
- Partial failure: Store what succeeded, log failures

## Data Refresh

### Sync Triggers

1. **Manual refresh** - User clicks "↻ Refresh" button
2. **Auto-refresh** - On dashboard load if `last_sync_at` > 1 hour ago

### Cache Strategy

- Store fetched data in `campaign_metrics` (persistent cache)
- Don't re-fetch if `last_sync_at` < 1 hour ago
- Dashboard reads from database, not live API
- LinkedIn allows ~100 requests/day - 1-hour cache prevents excessive calls

## Connection Setup

### Settings → Integrations Flow

1. User sees "LinkedIn" card with "Connect" button
2. Click Connect → Modal with fields:
   - **Organization ID** (text) - "Found in your LinkedIn Company Page URL"
   - **Access Token** (password) - "Generate at developers.linkedin.com"
3. Submit → Validate token by calling LinkedIn API
4. Success → Store credentials, show "Connected"
5. Failure → Show error, keep modal open

### Connection Status Display

- **Not connected**: "Connect" button
- **Connected**: Green checkmark, "Last synced: X ago", "Disconnect" button
- **Error (token expired)**: Orange warning, "Reconnect" button

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/platforms/linkedin/client.ts` | LinkedIn API client |
| `lib/platforms/linkedin/adapter.ts` | Data fetching and normalization |
| `lib/platforms/linkedin/types.ts` | TypeScript types for API responses |
| `lib/platforms/linkedin/actions.ts` | Server actions for sync |
| `components/dashboard/linkedin-section.tsx` | Dashboard UI component |
| `components/dashboard/metric-card.tsx` | Reusable metric card |
| `components/integrations/linkedin-connect-dialog.tsx` | Connection modal |
| `supabase/migrations/XXX_add_org_to_metrics.sql` | Schema migration |

## Security

- Access tokens stored in `platform_connections.credentials` (encrypted via pgcrypto)
- Tokens never exposed to client/browser
- RLS policies ensure org-level isolation
- Server-side only API calls

## Future Enhancements

- OAuth flow once Marketing Developer Platform approval is granted
- Post-level metrics breakdown
- Campaign attribution by date range overlap
