# Metrics System Documentation

## Overview

The dashboard displays marketing metrics from three platforms: LinkedIn, Google Analytics, and HubSpot. Data is stored as **daily snapshots** in the `campaign_metrics` table and aggregated by the UI based on the selected period (7d, 30d, quarter).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    3 AM UTC Daily    ┌─────────────────────────────────┐  │
│  │ Vercel Cron  │ ──────────────────► │ /api/cron/daily-metrics-sync    │  │
│  └──────────────┘                      │ Fetches YESTERDAY's daily data  │  │
│                                        │ Stores as single-day records    │  │
│                                        └─────────────────────────────────┘  │
│                                                       │                      │
│                                                       ▼                      │
│  ┌──────────────┐    View Dashboard    ┌─────────────────────────────────┐  │
│  │    User      │ ──────────────────► │ getLinkedInMetrics()            │  │
│  │              │                      │ getGoogleAnalyticsMetrics()     │  │
│  │              │                      │ getHubSpotMetrics()             │  │
│  └──────────────┘                      └─────────────────────────────────┘  │
│                                                       │                      │
│                                                       ▼                      │
│                                        ┌─────────────────────────────────┐  │
│                                        │     campaign_metrics table      │  │
│                                        │  (daily snapshots per metric)   │  │
│                                        └─────────────────────────────────┘  │
│                                                       │                      │
│                                                       ▼                      │
│                                        ┌─────────────────────────────────┐  │
│                                        │   UI aggregates by period       │  │
│                                        │   7d = sum last 7 daily values  │  │
│                                        └─────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Critical Rule: Daily Data Only

**NEVER store accumulated period totals as daily values.**

### Correct ✅
```typescript
// Fetch ONE day's data, store with THAT day's date
const dailyMetrics = await adapter.fetchDailyMetrics(jan28, jan28)
// jan28.impressions = 50 (actual daily value)
adapter.normalizeDailyMetricsToDbRecords(dailyMetrics, orgId)
// Stored: { date: '2026-01-28', metric_type: 'linkedin_impressions', value: 50 }
```

### Wrong ❌
```typescript
// Fetch 7 days of accumulated data, store as single day
const periodMetrics = await adapter.fetchMetrics(jan22, jan28)
// periodMetrics.impressions = 500 (7-day total!)
adapter.normalizeToDbRecords(periodMetrics, orgId, new Date())
// Stored: { date: '2026-01-28', metric_type: 'linkedin_impressions', value: 500 }
// BUG: This makes Jan 28 look like it had 500 impressions!
```

## Data Storage Schema

```sql
-- Each row is ONE metric for ONE day
CREATE TABLE campaign_metrics (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  platform_type TEXT NOT NULL,  -- 'linkedin', 'google_analytics', 'hubspot'
  date DATE NOT NULL,           -- The specific day this metric is for
  metric_type TEXT NOT NULL,    -- e.g., 'linkedin_impressions'
  value NUMERIC NOT NULL,       -- The value FOR THAT SPECIFIC DAY

  UNIQUE(organization_id, platform_type, date, metric_type)
);
```

## Cron Job

**Schedule:** Daily at 3 AM UTC (`0 3 * * *`)

**What it does:**
1. Gets all active platform connections
2. For each connection, fetches YESTERDAY's metrics from the platform API
3. Stores daily values in `campaign_metrics` (upsert to avoid duplicates)
4. Updates `platform_connections.last_sync_at`

**Verify cron is running:**
```sql
-- Check last_sync_at for all connections
SELECT organization_id, platform_type, last_sync_at, status
FROM platform_connections
WHERE status = 'active'
ORDER BY last_sync_at DESC;

-- If last_sync_at is more than 24-48 hours old, cron may not be running
```

**Vercel Cron Logs:**
1. Go to Vercel Dashboard → Project → Logs
2. Filter by "cron" or look for `/api/cron/daily-metrics-sync`
3. Check for errors

## Troubleshooting

### Symptom: Massive spike in dashboard charts

**Cause:** Accumulated period data was stored as a single day's value.

**Solution:**
1. Identify the bad date(s) by querying:
   ```sql
   SELECT date, metric_type, value
   FROM campaign_metrics
   WHERE organization_id = '<org_id>'
     AND platform_type = 'linkedin'
     AND date >= '2026-01-20'
   ORDER BY date, metric_type;
   ```
   Look for values 10-100x higher than surrounding days.

2. Delete the corrupted records:
   ```sql
   DELETE FROM campaign_metrics
   WHERE organization_id = '<org_id>'
     AND platform_type = 'linkedin'
     AND date IN ('2026-01-28', '2026-01-29');
   ```

3. Backfill with correct data:
   ```bash
   npm run backfill:metrics -- 2026-01-28 --prod
   ```

### Symptom: Dashboard shows stale data

**Check 1:** Is the cron running?
```sql
SELECT platform_type, last_sync_at
FROM platform_connections
WHERE organization_id = '<org_id>';
```
If `last_sync_at` is >48 hours old, the cron isn't running.

**Check 2:** Verify Vercel cron configuration
- Check `vercel.json` has the cron defined
- Check Vercel dashboard → Settings → Crons
- Check `CRON_SECRET` environment variable is set

**Check 3:** Check for errors in Vercel logs
- Filter logs by "Cron Error" or the endpoint path

### Symptom: Cron runs but data isn't synced

**Possible causes:**
1. OAuth token expired → Check `platform_connections.status` for 'failed'
2. API rate limits → Check logs for 429 errors
3. Platform API down → Check platform status pages

## Manual Operations

### Backfill Historical Data
```bash
# Backfill from a specific date to today
npm run backfill:metrics -- 2026-01-20 --prod

# Backfill a specific date range
npm run backfill:metrics -- 2026-01-20 2026-01-25 --prod
```

### Manual Sync (User-triggered)
Users can click the refresh button on the dashboard to trigger:
- `syncLinkedInMetrics()`
- `syncGoogleAnalyticsMetrics()`
- `syncHubSpotMetrics()`

These fetch yesterday's daily data and store it correctly.

### Test Cron Manually
```bash
# From local development
curl -X POST http://localhost:3000/api/cron/daily-metrics-sync \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# On production (replace with your domain and secret)
curl -X POST https://your-domain.vercel.app/api/cron/daily-metrics-sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Metric Types

### LinkedIn
- `linkedin_followers` - Total follower count (cumulative)
- `linkedin_follower_growth` - New followers that day
- `linkedin_impressions` - Post impressions
- `linkedin_reactions` - Likes + comments + shares
- `linkedin_page_views` - Company page views
- `linkedin_unique_visitors` - Unique page visitors

### Google Analytics
- `ga_active_users` - Active users
- `ga_new_users` - New users
- `ga_sessions` - Total sessions
- `ga_traffic_direct` - Direct traffic sessions
- `ga_traffic_organic_search` - Organic search sessions
- `ga_traffic_email` - Email traffic sessions
- `ga_traffic_organic_social` - Social media sessions
- `ga_traffic_referral` - Referral sessions

### HubSpot
- `hubspot_total_contacts` - Total contacts (cumulative)
- `hubspot_new_contacts` - New contacts that day
- `hubspot_total_companies` - Total companies (cumulative)
- `hubspot_new_companies` - New companies that day
- `hubspot_total_deals` - Total deals (cumulative)
- `hubspot_new_deals` - New deals that day
- `hubspot_deals_value` - Total deal value

## Code Locations

| Component | Location |
|-----------|----------|
| Cron job | `app/api/cron/daily-metrics-sync/route.ts` |
| LinkedIn sync | `lib/platforms/linkedin/actions.ts` |
| GA sync | `lib/platforms/google-analytics/actions.ts` |
| HubSpot sync | `lib/platforms/hubspot/actions.ts` |
| Metrics helpers | `lib/metrics/helpers.ts` |
| Metrics queries | `lib/metrics/queries.ts` |
| Dashboard UI | `components/dashboard/integrations-panel.tsx` |
| Backfill script | `scripts/backfill-metrics.ts` |

## Prevention Checklist

Before deploying changes to the metrics system:

- [ ] Does `fetchDailyMetrics()` fetch ONE day at a time?
- [ ] Does `normalizeDailyMetricsToDbRecords()` use the actual date from the metrics?
- [ ] Are period totals NEVER stored as single-day values?
- [ ] Does the cron job only sync yesterday's data?
- [ ] Are there console logs for debugging sync operations?
