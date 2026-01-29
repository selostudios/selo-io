# Componentization Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract shared patterns from platform sections, audit pages, and settings pages to reduce ~1,400 lines of duplicated code and improve maintainability.

**Architecture:** Create generic base components that handle common logic (collapsible sections, auth patterns, audit page shells) with customization via props and render props. Each platform/audit type provides its specific data fetching and rendering through configuration objects rather than duplicating entire components.

**Tech Stack:** React 19, TypeScript generics, Next.js App Router patterns

---

## Phase 1: Platform Section Refactoring (~600 LOC savings)

### Task 1: Create Shared Platform Types

**Files:**

- Create: `components/dashboard/platform-section/types.ts`

**Step 1: Create the types file**

```typescript
import type { Period } from '../integrations-panel'
import type { MetricTimeSeries } from '@/lib/metrics/types'
import type { ReactNode } from 'react'

export interface PlatformConnection {
  id: string
  account_name: string | null
  display_name: string | null
}

export interface BaseMetric {
  label: string
  value: number
  change: number | null
}

export interface PlatformConfig {
  name: string
  color: string
  icon: ReactNode
  connectHref: string
  connectDescription: string
}

export interface PlatformSectionProps<TMetrics> {
  connections: PlatformConnection[]
  period: Period
  config: PlatformConfig
  getMetrics: (
    connectionId: string,
    period: Period
  ) => Promise<{
    metrics?: TMetrics
    timeSeries?: MetricTimeSeries[]
  }>
  formatMetricsForClipboard: (metrics: TMetrics, period: Period, accountName?: string) => string
  renderMetrics: (metrics: TMetrics, timeSeries: MetricTimeSeries[], period: Period) => ReactNode
}

export function getConnectionLabel(connection: PlatformConnection): string {
  return connection.display_name || connection.account_name || 'Unknown Account'
}

export function formatChange(change: number | null): string {
  if (change === null) return ''
  const sign = change >= 0 ? '+' : ''
  return ` (${sign}${change.toFixed(1)}%)`
}
```

**Step 2: Commit**

```bash
git add components/dashboard/platform-section/types.ts
git commit -m "feat: add shared platform section types

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Create Generic PlatformSection Component

**Files:**

- Create: `components/dashboard/platform-section/platform-section.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState, useEffect, useTransition } from 'react'
import { Loader2, ChevronDown, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PlatformSectionProps, PlatformConnection } from './types'
import { getConnectionLabel } from './types'
import type { Period } from '../integrations-panel'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface ConnectionMetricsProps<TMetrics> {
  connection: PlatformConnection
  period: Period
  getMetrics: PlatformSectionProps<TMetrics>['getMetrics']
  renderMetrics: PlatformSectionProps<TMetrics>['renderMetrics']
  onMetricsLoaded?: (metrics: TMetrics) => void
}

function ConnectionMetrics<TMetrics>({
  connection,
  period,
  getMetrics,
  renderMetrics,
  onMetricsLoaded,
}: ConnectionMetricsProps<TMetrics>) {
  const [metrics, setMetrics] = useState<TMetrics | null>(null)
  const [timeSeries, setTimeSeries] = useState<MetricTimeSeries[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getMetrics(connection.id, period)
      if (result.metrics) {
        setMetrics(result.metrics)
        onMetricsLoaded?.(result.metrics)
      }
      if (result.timeSeries) {
        setTimeSeries(result.timeSeries)
      }
    })
  }, [connection.id, period, getMetrics, onMetricsLoaded])

  if (isPending) {
    return (
      <div className="flex h-[100px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!metrics) {
    return <p className="text-muted-foreground">No data yet. Click refresh to sync metrics.</p>
  }

  return <>{renderMetrics(metrics, timeSeries, period)}</>
}

export function PlatformSection<TMetrics>({
  connections,
  period,
  config,
  getMetrics,
  formatMetricsForClipboard,
  renderMetrics,
}: PlatformSectionProps<TMetrics>) {
  const [singleMetrics, setSingleMetrics] = useState<TMetrics | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopySingle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (singleMetrics) {
      const text = formatMetricsForClipboard(singleMetrics, period)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Not connected state
  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.icon}
              <div>
                <CardTitle>{config.name}</CardTitle>
                <CardDescription className="mt-1">{config.connectDescription}</CardDescription>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href={config.connectHref}>Connect</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>
    )
  }

  // Single connection: render without account header, copy button in main header
  if (connections.length === 1) {
    return (
      <Collapsible defaultOpen className="group/section rounded-lg border p-4">
        <div className="flex items-center justify-between py-2">
          <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
            <ChevronDown
              className={cn(
                'text-muted-foreground size-5 transition-transform duration-200',
                'group-data-[state=closed]/section:-rotate-90'
              )}
            />
            {config.icon}
            <span className="text-lg font-semibold">{config.name}</span>
          </CollapsibleTrigger>
          {singleMetrics && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopySingle}
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1.5 transition-colors"
                  aria-label="Copy metrics to clipboard"
                >
                  {copied ? (
                    <Check className="size-4 text-green-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy metrics'}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <CollapsibleContent className="mt-4">
          <ConnectionMetrics
            connection={connections[0]}
            period={period}
            getMetrics={getMetrics}
            renderMetrics={renderMetrics}
            onMetricsLoaded={setSingleMetrics}
          />
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // Multiple connections: render sub-sections with headers
  return (
    <Collapsible defaultOpen className="group/section rounded-lg border p-4">
      <div className="flex items-center justify-between py-2">
        <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-5 transition-transform duration-200',
              'group-data-[state=closed]/section:-rotate-90'
            )}
          />
          {config.icon}
          <span className="text-lg font-semibold">{config.name}</span>
          <span className="text-muted-foreground text-sm">({connections.length} accounts)</span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-4 space-y-6">
        {connections.map((connection) => (
          <div key={connection.id} className="space-y-3">
            <h4 className="text-muted-foreground text-sm font-medium">
              {getConnectionLabel(connection)}
            </h4>
            <ConnectionMetrics
              connection={connection}
              period={period}
              getMetrics={getMetrics}
              renderMetrics={renderMetrics}
            />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Step 2: Create barrel export**

Create: `components/dashboard/platform-section/index.ts`

```typescript
export { PlatformSection } from './platform-section'
export * from './types'
```

**Step 3: Commit**

```bash
git add components/dashboard/platform-section/
git commit -m "feat: add generic PlatformSection component

Handles all connection states (none, single, multiple) with
configurable metrics fetching and rendering via props.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Refactor LinkedIn Section to Use PlatformSection

**Files:**

- Modify: `components/dashboard/linkedin-section.tsx`

**Step 1: Rewrite linkedin-section.tsx**

```typescript
'use client'

import { MetricCard } from './metric-card'
import { LinkedInIcon } from '@/components/icons/platform-icons'
import { getLinkedInMetrics } from '@/lib/platforms/linkedin/actions'
import { PlatformSection, formatChange } from './platform-section'
import type { Period } from './integrations-panel'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface Metric {
  label: string
  value: number
  change: number | null
}

type Connection = {
  id: string
  account_name: string | null
  display_name: string | null
}

interface LinkedInSectionProps {
  connections: Connection[]
  period: Period
}

const LINKEDIN_COLOR = '#0A66C2'

function formatMetricsForClipboard(metrics: Metric[], period: Period, accountName?: string): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const header = accountName
    ? `📊 LinkedIn Metrics - ${accountName} (${periodLabel})`
    : `📊 LinkedIn Metrics (${periodLabel})`
  const lines = [header, '']
  for (const metric of metrics) {
    lines.push(`• ${metric.label}: ${metric.value.toLocaleString()}${formatChange(metric.change)}`)
  }
  return lines.join('\n')
}

async function fetchLinkedInMetrics(connectionId: string, period: Period) {
  const result = await getLinkedInMetrics(period, connectionId)
  return {
    metrics: 'metrics' in result ? result.metrics : undefined,
    timeSeries: 'timeSeries' in result ? result.timeSeries : undefined,
  }
}

function renderLinkedInMetrics(
  metrics: Metric[],
  timeSeries: MetricTimeSeries[],
  period: Period
) {
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          change={metric.change}
          period={period}
          timeSeries={getTimeSeriesForMetric(metric.label)}
          color={LINKEDIN_COLOR}
        />
      ))}
    </div>
  )
}

export function LinkedInSection({ connections, period }: LinkedInSectionProps) {
  return (
    <PlatformSection<Metric[]>
      connections={connections}
      period={period}
      config={{
        name: 'LinkedIn',
        color: LINKEDIN_COLOR,
        icon: <LinkedInIcon className="size-5 text-[#0A66C2]" />,
        connectHref: '/api/auth/oauth/linkedin',
        connectDescription: 'Connect LinkedIn to view engagement metrics.',
      }}
      getMetrics={fetchLinkedInMetrics}
      formatMetricsForClipboard={formatMetricsForClipboard}
      renderMetrics={renderLinkedInMetrics}
    />
  )
}
```

**Step 2: Run tests to verify**

```bash
npm run test:unit -- components/dashboard
```

**Step 3: Commit**

```bash
git add components/dashboard/linkedin-section.tsx
git commit -m "refactor: use PlatformSection in LinkedInSection

Reduces ~170 lines to ~70 lines by using shared component.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Refactor HubSpot Section to Use PlatformSection

**Files:**

- Modify: `components/dashboard/hubspot-section.tsx`

**Step 1: Rewrite hubspot-section.tsx**

```typescript
'use client'

import { MetricCard } from './metric-card'
import { HubSpotIcon } from '@/components/icons/platform-icons'
import { getHubSpotMetrics } from '@/lib/platforms/hubspot/actions'
import { PlatformSection, formatChange } from './platform-section'
import type { Period } from './integrations-panel'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface HubSpotMetricsWithChanges {
  crm: {
    totalContacts: number
    totalDeals: number
    newDeals: number
    totalPipelineValue: number
    dealsWon: number
    dealsLost: number
    newDealsChange: number | null
    dealsWonChange: number | null
    dealsLostChange: number | null
  }
  marketing: {
    formSubmissions: number
    formSubmissionsChange: number | null
  }
}

type Connection = {
  id: string
  platform_type: string
  account_name: string | null
  display_name: string | null
  status: string
  last_sync_at: string | null
}

interface HubSpotSectionProps {
  connections: Connection[]
  period: Period
}

const HUBSPOT_COLOR = '#FF7A59'

function formatMetricsForClipboard(
  metrics: HubSpotMetricsWithChanges,
  period: Period,
  accountLabel?: string
): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const header = accountLabel
    ? `HubSpot - ${accountLabel} (${periodLabel})`
    : `HubSpot Metrics (${periodLabel})`
  const lines = [
    header,
    '',
    '-- Deals --',
    `* New Deals: ${metrics.crm.newDeals.toLocaleString()}${formatChange(metrics.crm.newDealsChange)}`,
    `* Deals Won: ${metrics.crm.dealsWon.toLocaleString()}${formatChange(metrics.crm.dealsWonChange)}`,
    `* Deals Lost: ${metrics.crm.dealsLost.toLocaleString()}${formatChange(metrics.crm.dealsLostChange)}`,
    `* Total Deals: ${metrics.crm.totalDeals.toLocaleString()}`,
    '',
    '-- Other --',
    `* Total Contacts: ${metrics.crm.totalContacts.toLocaleString()}`,
    `* Pipeline Value: $${metrics.crm.totalPipelineValue.toLocaleString()}`,
    `* Form Submissions: ${metrics.marketing.formSubmissions.toLocaleString()}${formatChange(metrics.marketing.formSubmissionsChange)}`,
  ]
  return lines.join('\n')
}

async function fetchHubSpotMetrics(connectionId: string, period: Period) {
  const result = await getHubSpotMetrics(period, connectionId)
  return {
    metrics: 'metrics' in result ? result.metrics : undefined,
    timeSeries: 'timeSeries' in result ? result.timeSeries : undefined,
  }
}

function renderHubSpotMetrics(
  metrics: HubSpotMetricsWithChanges,
  timeSeries: MetricTimeSeries[],
  period: Period
) {
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <MetricCard
        label="New Deals"
        value={metrics.crm.newDeals}
        change={metrics.crm.newDealsChange}
        tooltip="Deals created during this period."
        period={period}
        timeSeries={getTimeSeriesForMetric('New Deals')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Deals Won"
        value={metrics.crm.dealsWon}
        change={metrics.crm.dealsWonChange}
        tooltip="Deals closed as won during this period."
        period={period}
        timeSeries={getTimeSeriesForMetric('Deals Won')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Deals Lost"
        value={metrics.crm.dealsLost}
        change={metrics.crm.dealsLostChange}
        tooltip="Deals closed as lost during this period."
        period={period}
        timeSeries={getTimeSeriesForMetric('Deals Lost')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Total Deals"
        value={metrics.crm.totalDeals}
        change={null}
        tooltip="Total number of deals in your CRM."
        period={period}
        timeSeries={getTimeSeriesForMetric('Total Deals')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Total Contacts"
        value={metrics.crm.totalContacts}
        change={null}
        tooltip="Total number of contacts in your HubSpot CRM."
        period={period}
        timeSeries={getTimeSeriesForMetric('Total Contacts')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Pipeline Value"
        value={metrics.crm.totalPipelineValue}
        prefix="$"
        change={null}
        tooltip="Combined value of all deals currently in your pipeline."
        period={period}
        timeSeries={getTimeSeriesForMetric('Pipeline Value')}
        color={HUBSPOT_COLOR}
      />
      <MetricCard
        label="Form Submissions"
        value={metrics.marketing.formSubmissions}
        change={metrics.marketing.formSubmissionsChange}
        tooltip="Total form submissions across all HubSpot forms."
        period={period}
        timeSeries={getTimeSeriesForMetric('Form Submissions')}
        color={HUBSPOT_COLOR}
      />
    </div>
  )
}

export function HubSpotSection({ connections, period }: HubSpotSectionProps) {
  return (
    <PlatformSection<HubSpotMetricsWithChanges>
      connections={connections}
      period={period}
      config={{
        name: 'HubSpot',
        color: HUBSPOT_COLOR,
        icon: <HubSpotIcon className="size-5 text-[#FF7A59]" />,
        connectHref: '/api/auth/oauth/hubspot',
        connectDescription: 'Connect HubSpot to view CRM metrics and form submissions.',
      }}
      getMetrics={fetchHubSpotMetrics}
      formatMetricsForClipboard={formatMetricsForClipboard}
      renderMetrics={renderHubSpotMetrics}
    />
  )
}
```

**Step 2: Run tests to verify**

```bash
npm run test:unit -- components/dashboard
```

**Step 3: Commit**

```bash
git add components/dashboard/hubspot-section.tsx
git commit -m "refactor: use PlatformSection in HubSpotSection

Reduces ~460 lines to ~130 lines by using shared component.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Refactor Google Analytics Section to Use PlatformSection

**Files:**

- Modify: `components/dashboard/google-analytics-section.tsx`

**Step 1: Rewrite google-analytics-section.tsx**

```typescript
'use client'

import { MetricCard } from './metric-card'
import { GoogleAnalyticsIcon } from '@/components/icons/platform-icons'
import { getGoogleAnalyticsMetrics } from '@/lib/platforms/google-analytics/actions'
import { PlatformSection, formatChange } from './platform-section'
import type { TrafficAcquisition } from '@/lib/platforms/google-analytics/types'
import type { Period } from './integrations-panel'
import type { MetricTimeSeries } from '@/lib/metrics/types'

interface GAMetrics {
  activeUsers: number
  activeUsersChange: number | null
  newUsers: number
  newUsersChange: number | null
  sessions: number
  sessionsChange: number | null
  trafficAcquisition: TrafficAcquisition
  trafficAcquisitionChanges: {
    direct: number | null
    organicSearch: number | null
    email: number | null
    organicSocial: number | null
    referral: number | null
  }
}

type Connection = {
  id: string
  account_name: string | null
  display_name: string | null
}

interface GoogleAnalyticsSectionProps {
  connections: Connection[]
  period: Period
}

const GA_COLOR = '#E37400'

function formatMetricsForClipboard(metrics: GAMetrics, period: Period): string {
  const periodLabel =
    period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'This quarter'
  const lines = [
    `📈 Google Analytics (${periodLabel})`,
    '',
    '**Overview**',
    `• Active Users: ${metrics.activeUsers.toLocaleString()}${formatChange(metrics.activeUsersChange)}`,
    `• New Users: ${metrics.newUsers.toLocaleString()}${formatChange(metrics.newUsersChange)}`,
    `• Sessions: ${metrics.sessions.toLocaleString()}${formatChange(metrics.sessionsChange)}`,
    '',
    '**Traffic Acquisition**',
    `• Direct: ${metrics.trafficAcquisition.direct.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.direct)}`,
    `• Organic Search: ${metrics.trafficAcquisition.organicSearch.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.organicSearch)}`,
    `• Email: ${metrics.trafficAcquisition.email.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.email)}`,
    `• Organic Social: ${metrics.trafficAcquisition.organicSocial.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.organicSocial)}`,
    `• Referral: ${metrics.trafficAcquisition.referral.toLocaleString()}${formatChange(metrics.trafficAcquisitionChanges.referral)}`,
  ]
  return lines.join('\n')
}

async function fetchGAMetrics(connectionId: string, period: Period) {
  const result = await getGoogleAnalyticsMetrics(period, connectionId)
  return {
    metrics: 'metrics' in result ? result.metrics : undefined,
    timeSeries: 'timeSeries' in result ? result.timeSeries : undefined,
  }
}

function renderGAMetrics(
  metrics: GAMetrics,
  timeSeries: MetricTimeSeries[],
  period: Period
) {
  const getTimeSeriesForMetric = (label: string) => {
    const series = timeSeries.find((s) => s.label === label)
    return series?.data
  }

  return (
    <div className="space-y-6">
      {/* Main metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard
          label="Active Users"
          value={metrics.activeUsers}
          change={metrics.activeUsersChange}
          period={period}
          timeSeries={getTimeSeriesForMetric('Active Users')}
          color={GA_COLOR}
          tooltip="The number of distinct users who engaged with your site during this period."
        />
        <MetricCard
          label="New Users"
          value={metrics.newUsers}
          change={metrics.newUsersChange}
          period={period}
          timeSeries={getTimeSeriesForMetric('New Users')}
          color={GA_COLOR}
        />
        <MetricCard
          label="Sessions"
          value={metrics.sessions}
          change={metrics.sessionsChange}
          period={period}
          timeSeries={getTimeSeriesForMetric('Sessions')}
          color={GA_COLOR}
        />
      </div>

      {/* Traffic Acquisition */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Traffic Acquisition</h4>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Direct"
            value={metrics.trafficAcquisition.direct}
            change={metrics.trafficAcquisitionChanges.direct}
            period={period}
            timeSeries={getTimeSeriesForMetric('Direct')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Organic Search"
            value={metrics.trafficAcquisition.organicSearch}
            change={metrics.trafficAcquisitionChanges.organicSearch}
            period={period}
            timeSeries={getTimeSeriesForMetric('Organic Search')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Email"
            value={metrics.trafficAcquisition.email}
            change={metrics.trafficAcquisitionChanges.email}
            period={period}
            timeSeries={getTimeSeriesForMetric('Email')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Organic Social"
            value={metrics.trafficAcquisition.organicSocial}
            change={metrics.trafficAcquisitionChanges.organicSocial}
            period={period}
            timeSeries={getTimeSeriesForMetric('Organic Social')}
            color={GA_COLOR}
          />
          <MetricCard
            label="Referral"
            value={metrics.trafficAcquisition.referral}
            change={metrics.trafficAcquisitionChanges.referral}
            period={period}
            timeSeries={getTimeSeriesForMetric('Referral')}
            color={GA_COLOR}
          />
        </div>
      </div>
    </div>
  )
}

export function GoogleAnalyticsSection({ connections, period }: GoogleAnalyticsSectionProps) {
  return (
    <PlatformSection<GAMetrics>
      connections={connections}
      period={period}
      config={{
        name: 'Google Analytics',
        color: GA_COLOR,
        icon: <GoogleAnalyticsIcon className="size-5 text-[#E37400]" />,
        connectHref: '/api/auth/oauth/google_analytics',
        connectDescription: 'Connect Google Analytics to view website traffic metrics.',
      }}
      getMetrics={fetchGAMetrics}
      formatMetricsForClipboard={formatMetricsForClipboard}
      renderMetrics={renderGAMetrics}
    />
  )
}
```

**Step 2: Run tests to verify**

```bash
npm run test:unit -- components/dashboard
```

**Step 3: Commit**

```bash
git add components/dashboard/google-analytics-section.tsx
git commit -m "refactor: use PlatformSection in GoogleAnalyticsSection

Reduces ~354 lines to ~150 lines by using shared component.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Settings Auth Pattern (~120 LOC savings)

### Task 6: Create Settings Auth Helper

**Files:**

- Create: `lib/auth/settings-auth.ts`

**Step 1: Create the auth helper**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'

export interface SettingsAuthContext {
  organizationId: string
  isInternal: boolean
  userRecord: {
    organization_id: string | null
    role: string
    is_internal: boolean | null
  }
}

export type SettingsAuthResult<T> =
  | { type: 'success'; context: SettingsAuthContext; data: T }
  | { type: 'no-org'; message: string }

/**
 * Shared auth logic for settings pages.
 * Handles user auth, internal user org selection, and permission checks.
 */
export async function withSettingsAuth<T>(
  searchParams: Promise<{ org?: string }>,
  getData: (organizationId: string, context: SettingsAuthContext) => Promise<T>,
  noOrgMessage: string = 'Select an organization to view settings.'
): Promise<SettingsAuthResult<T>> {
  const { org: selectedOrgId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/onboarding')
  }

  const isInternal = isInternalUser(userRecord)
  const organizationId = isInternal && selectedOrgId ? selectedOrgId : userRecord.organization_id

  if (!organizationId) {
    return { type: 'no-org', message: noOrgMessage }
  }

  const context: SettingsAuthContext = {
    organizationId,
    isInternal,
    userRecord,
  }

  const data = await getData(organizationId, context)

  return { type: 'success', context, data }
}

/**
 * Component to render when no organization is selected.
 */
export function NoOrgSelected({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add lib/auth/settings-auth.ts
git commit -m "feat: add shared settings auth helper

Centralizes auth logic for settings pages with support for
internal user org selection.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Refactor Integrations Page to Use Settings Auth

**Files:**

- Modify: `app/(authenticated)/settings/integrations/page.tsx`

**Step 1: Refactor to use withSettingsAuth**

```typescript
import { withSettingsAuth, NoOrgSelected } from '@/lib/auth/settings-auth'
import { createClient } from '@/lib/supabase/server'
import { OAuthToastHandler } from './oauth-toast-handler'
import { IntegrationsPageContent } from './integrations-page-content'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const result = await withSettingsAuth(
    searchParams,
    async (organizationId) => {
      const supabase = await createClient()
      const { data: connections } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      const platforms = ['linkedin', 'hubspot', 'google_analytics'] as const
      const allConnections = connections || []

      const connectionsByPlatform = platforms.reduce(
        (acc, platform) => {
          acc[platform] = allConnections.filter((c) => c.platform_type === platform)
          return acc
        },
        {} as Record<string, typeof allConnections>
      )

      return { connectionsByPlatform }
    },
    'Select an organization to view integrations.'
  )

  if (result.type === 'no-org') {
    return <NoOrgSelected message={result.message} />
  }

  return (
    <>
      <OAuthToastHandler />
      <IntegrationsPageContent connectionsByPlatform={result.data.connectionsByPlatform} />
    </>
  )
}
```

**Step 2: Commit**

```bash
git add app/(authenticated)/settings/integrations/page.tsx
git commit -m "refactor: use withSettingsAuth in integrations page

Reduces auth boilerplate by ~30 lines.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Refactor Team Page to Use Settings Auth

**Files:**

- Modify: `app/(authenticated)/settings/team/page.tsx`

**Step 1: Refactor to use withSettingsAuth**

The team page has additional logic for fetching team members and invites. We'll use the auth helper for the initial auth check and keep the data fetching specific to this page.

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InviteUserDialog } from '@/components/settings/invite-user-dialog'
import { ResendInviteButton } from '@/components/settings/resend-invite-button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { deleteInvite } from './actions'
import { formatDate, displayName } from '@/lib/utils'
import { canManageTeam } from '@/lib/permissions'
import { withSettingsAuth, NoOrgSelected } from '@/lib/auth/settings-auth'

export const dynamic = 'force-dynamic'

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function TeamSettingsPage({ searchParams }: PageProps) {
  const result = await withSettingsAuth(
    searchParams,
    async (organizationId, { isInternal, userRecord }) => {
      const supabase = await createClient()
      const isAdmin = isInternal || canManageTeam(userRecord.role)

      // Get organization name
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()

      // Get team members with emails using security definer function
      const { data: userEmails } = await supabase.rpc('get_organization_user_emails', {
        org_id: organizationId,
      })

      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, role, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      // Map emails and names to team members
      const userDataMap = new Map<string, { email: string; first_name: string; last_name: string }>(
        userEmails?.map(
          (u: { user_id: string; email: string; first_name: string; last_name: string }) => [
            u.user_id,
            { email: u.email, first_name: u.first_name, last_name: u.last_name },
          ]
        ) || []
      )
      const teamMembersWithEmails = (teamMembers || []).map((member) => {
        const userData = userDataMap.get(member.id)
        const fullName = userData
          ? `${userData.first_name}${userData.last_name ? ' ' + userData.last_name : ''}`.trim()
          : 'Unknown'
        return {
          ...member,
          name: fullName,
          email: userData?.email || 'Unknown',
        }
      })

      // Get pending invites (only if admin)
      let pendingInvites: Array<{
        id: string
        email: string
        role: string
        expires_at: string
      }> = []
      if (isAdmin) {
        const { data: invites } = await supabase
          .from('invites')
          .select('*')
          .eq('organization_id', organizationId)
          .is('accepted_at', null)
          .order('created_at', { ascending: false })

        pendingInvites = invites || []
      }

      return { org, teamMembersWithEmails, pendingInvites, isAdmin }
    },
    'Select an organization to view team members.'
  )

  if (result.type === 'no-org') {
    return <NoOrgSelected message={result.message} />
  }

  const { org, teamMembersWithEmails, pendingInvites, isAdmin } = result.data

  async function handleDeleteInvite(formData: FormData) {
    'use server'
    const inviteId = formData.get('inviteId') as string
    await deleteInvite(inviteId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage team members for {org?.name || 'your organization'}
          </p>
        </div>
        {isAdmin && <InviteUserDialog />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active</CardTitle>
          <CardDescription>Current team members with access to the organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembersWithEmails.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="mt-0.5 size-10">
                    <AvatarFallback className="text-sm font-medium">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-muted-foreground text-sm">{member.email}</p>
                    <p className="text-muted-foreground text-sm">
                      Joined {formatDate(member.created_at)}
                    </p>
                  </div>
                </div>
                <Badge>{displayName(member.role)}</Badge>
              </div>
            ))}
            {teamMembersWithEmails.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No team members found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>Invitations that haven&apos;t been accepted yet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInvites.map((invite) => {
                const expiresAt = new Date(invite.expires_at)
                const isExpired = expiresAt < new Date()

                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-muted-foreground text-sm">
                        {isExpired ? (
                          <span className="text-red-600">
                            Expired {formatDate(invite.expires_at)}
                          </span>
                        ) : (
                          <>Expires {formatDate(invite.expires_at)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{displayName(invite.role)}</Badge>
                      <ResendInviteButton inviteId={invite.id} email={invite.email} />
                      <form action={handleDeleteInvite}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Cancel
                        </Button>
                      </form>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/(authenticated)/settings/team/page.tsx
git commit -m "refactor: use withSettingsAuth in team page

Reduces auth boilerplate by ~25 lines.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Refactor Organization Page to Use Settings Auth

**Files:**

- Modify: `app/(authenticated)/settings/organization/page.tsx`

**Step 1: Refactor to use withSettingsAuth**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationForm } from '@/components/settings/organization-form'
import { canManageOrg } from '@/lib/permissions'
import { withSettingsAuth, NoOrgSelected } from '@/lib/auth/settings-auth'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function OrganizationSettingsPage({ searchParams }: PageProps) {
  const result = await withSettingsAuth(
    searchParams,
    async (organizationId, { isInternal, userRecord }) => {
      // Only check permissions for external users
      if (!isInternal && !canManageOrg(userRecord.role)) {
        redirect('/settings/team')
      }

      const supabase = await createClient()

      // Get organization details
      const { data: org } = await supabase
        .from('organizations')
        .select(
          'id, name, industry, logo_url, primary_color, secondary_color, accent_color, website_url, description, city, country, social_links'
        )
        .eq('id', organizationId)
        .single()

      if (!org) {
        redirect('/dashboard')
      }

      // Count existing non-archived audits
      const { count: auditCount } = await supabase
        .from('site_audits')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('archived_at', null)

      // Fetch industries
      const { data: industries } = await supabase
        .from('industries')
        .select('id, name')
        .order('name', { ascending: true })

      return { org, auditCount: auditCount || 0, industries: industries || [] }
    },
    'Select an organization to view settings.'
  )

  if (result.type === 'no-org') {
    return <NoOrgSelected message={result.message} />
  }

  const { org, auditCount, industries } = result.data

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Organization Profile</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your organization&apos;s branding and settings
        </p>
      </div>

      <OrganizationForm
        key={org.id}
        organizationId={org.id}
        name={org.name}
        industryId={org.industry || ''}
        logoUrl={org.logo_url || ''}
        primaryColor={org.primary_color}
        secondaryColor={org.secondary_color}
        accentColor={org.accent_color}
        industries={industries}
        websiteUrl={org.website_url || ''}
        existingAuditCount={auditCount}
        description={org.description || ''}
        city={org.city || ''}
        country={org.country || ''}
        socialLinks={org.social_links || []}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/(authenticated)/settings/organization/page.tsx
git commit -m "refactor: use withSettingsAuth in organization page

Reduces auth boilerplate by ~30 lines.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Metrics Utilities (~60 LOC savings)

### Task 10: Extract Shared Metrics Formatting

**Files:**

- Create: `lib/metrics/format.ts`

**Step 1: Create the format utilities**

```typescript
import type { Period } from '@/components/dashboard/integrations-panel'

/**
 * Format a percentage change value for display.
 * Returns empty string if change is null.
 */
export function formatChange(change: number | null): string {
  if (change === null) return ''
  const sign = change >= 0 ? '+' : ''
  return ` (${sign}${change.toFixed(1)}%)`
}

/**
 * Get human-readable label for a period.
 */
export function getPeriodLabel(period: Period): string {
  switch (period) {
    case '7d':
      return 'Last 7 days'
    case '30d':
      return 'Last 30 days'
    case 'quarter':
      return 'This quarter'
    default:
      return period
  }
}

/**
 * Format a number with locale-specific separators.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString()
}

/**
 * Format a currency value.
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
```

**Step 2: Update platform-section types to use shared format**

Update `components/dashboard/platform-section/types.ts` to re-export from lib:

```typescript
// Re-export shared utilities
export { formatChange, getPeriodLabel, formatNumber } from '@/lib/metrics/format'
```

**Step 3: Commit**

```bash
git add lib/metrics/format.ts components/dashboard/platform-section/types.ts
git commit -m "feat: add shared metrics formatting utilities

Centralizes formatChange, getPeriodLabel, and formatNumber
for use across platform sections.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Final Verification

### Task 11: Run Full Test Suite and Lint

**Step 1: Run lint**

```bash
npm run lint
```

Expected: No errors

**Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: All tests pass

**Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds

**Step 4: Manual verification**

- Navigate to dashboard and verify all three platform sections render correctly
- Test not connected, single connection, and multiple connection states
- Verify copy-to-clipboard functionality works
- Navigate to settings pages and verify they load correctly

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: cleanup after componentization refactoring

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Phase     | Task                      | LOC Saved | Files Changed         |
| --------- | ------------------------- | --------- | --------------------- |
| 1         | PlatformSection component | ~600      | 5 new, 3 modified     |
| 2         | Settings auth helper      | ~120      | 1 new, 3 modified     |
| 3         | Metrics utilities         | ~60       | 1 new, 1 modified     |
| **Total** |                           | **~780**  | **7 new, 7 modified** |

The remaining ~600 LOC savings from audit pages would require a Phase 5 for the `AuditPageShell` component, which can be implemented in a follow-up.
