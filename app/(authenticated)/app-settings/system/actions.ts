'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { ENV_VAR_MAP } from '@/lib/app-settings/credentials'
import { requireInternalUser } from '@/lib/app-settings/auth'

interface HealthStatus {
  service: string
  name: string
  status: 'healthy' | 'unconfigured' | 'inactive'
  lastActivity: string | null
}

interface ServiceTotal {
  service: string
  callCount: number
  totalTokensInput: number
  totalTokensOutput: number
  estimatedCost: number
}

interface OrgUsage {
  organizationId: string | null
  organizationName: string
  anthropicTokens: number
  anthropicCost: number
  emailCount: number
  psiCount: number
}

interface UsageSummary {
  totals: ServiceTotal[]
  byOrganization: OrgUsage[]
}

export async function getSystemHealth(): Promise<HealthStatus[] | { error: string }> {
  const { error, supabase } = await requireInternalUser()
  if (error) return { error }

  const serviceClient = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Check configured status for API services
  const { data: settings } = await supabase!.from('app_settings').select('key').order('key')
  const configuredKeys = new Set((settings ?? []).map((s) => s.key))

  // Get last activity from usage_logs per service + cron/sync health in parallel
  const apiServices = ['anthropic', 'resend', 'pagespeed'] as const
  const nameMap: Record<string, string> = {
    anthropic: 'Anthropic API',
    resend: 'Email (Resend)',
    pagespeed: 'PageSpeed Insights',
  }

  const [anthropicLog, resendLog, pagespeedLog, lastCronAudit, lastSync] = await Promise.all([
    serviceClient
      .from('usage_logs')
      .select('created_at')
      .eq('service', 'anthropic')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    serviceClient
      .from('usage_logs')
      .select('created_at')
      .eq('service', 'resend')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    serviceClient
      .from('usage_logs')
      .select('created_at')
      .eq('service', 'pagespeed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    serviceClient
      .from('audits')
      .select('created_at')
      .is('created_by', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    serviceClient
      .from('platform_connections')
      .select('last_sync_at')
      .not('last_sync_at', 'is', null)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const logResults = [anthropicLog, resendLog, pagespeedLog]
  const healthResults: HealthStatus[] = apiServices.map((service, i) => {
    const isConfigured = configuredKeys.has(service) || !!process.env[ENV_VAR_MAP[service]]
    const lastLog = logResults[i].data

    let status: HealthStatus['status'] = 'unconfigured'
    if (isConfigured) {
      if (lastLog && new Date(lastLog.created_at) > new Date(sevenDaysAgo)) {
        status = 'healthy'
      } else {
        status = 'inactive'
      }
    }

    return {
      service,
      name: nameMap[service] ?? service,
      status,
      lastActivity: lastLog?.created_at ?? null,
    }
  })

  healthResults.push({
    service: 'weekly_audits',
    name: 'Weekly Audits Cron',
    status: lastCronAudit.data
      ? new Date(lastCronAudit.data.created_at) > new Date(sevenDaysAgo)
        ? 'healthy'
        : 'inactive'
      : 'inactive',
    lastActivity: lastCronAudit.data?.created_at ?? null,
  })

  healthResults.push({
    service: 'daily_metrics',
    name: 'Daily Metrics Sync',
    status: lastSync.data
      ? new Date(lastSync.data.last_sync_at) > new Date(sevenDaysAgo)
        ? 'healthy'
        : 'inactive'
      : 'inactive',
    lastActivity: lastSync.data?.last_sync_at ?? null,
  })

  return healthResults
}

export async function getUsageSummary(
  period: '7d' | '30d' | 'month'
): Promise<UsageSummary | { error: string }> {
  const { error } = await requireInternalUser()
  if (error) return { error }

  const serviceClient = createServiceClient()

  // Calculate date range
  let startDate: string
  const now = new Date()
  if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  } else if (period === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  } else {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }

  // Fetch all usage logs in period
  const { data: logs, error: fetchError } = await serviceClient
    .from('usage_logs')
    .select('service, organization_id, tokens_input, tokens_output, cost')
    .gte('created_at', startDate)

  if (fetchError) {
    console.error('[App Settings Error]', {
      type: 'usage_summary',
      timestamp: new Date().toISOString(),
      error: fetchError.message,
    })
    return { error: 'Failed to load usage data' }
  }

  // Compute totals per service
  const serviceTotals = new Map<string, ServiceTotal>()
  for (const log of logs ?? []) {
    const existing = serviceTotals.get(log.service) ?? {
      service: log.service,
      callCount: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      estimatedCost: 0,
    }
    existing.callCount++
    existing.totalTokensInput += log.tokens_input ?? 0
    existing.totalTokensOutput += log.tokens_output ?? 0
    existing.estimatedCost += Number(log.cost ?? 0)
    serviceTotals.set(log.service, existing)
  }

  // Compute per-org breakdown
  const orgMap = new Map<
    string,
    { anthropicTokens: number; anthropicCost: number; emailCount: number; psiCount: number }
  >()

  for (const log of logs ?? []) {
    const orgKey = log.organization_id ?? '__none__'
    const existing = orgMap.get(orgKey) ?? {
      anthropicTokens: 0,
      anthropicCost: 0,
      emailCount: 0,
      psiCount: 0,
    }

    if (log.service === 'anthropic') {
      existing.anthropicTokens += (log.tokens_input ?? 0) + (log.tokens_output ?? 0)
      existing.anthropicCost += Number(log.cost ?? 0)
    } else if (log.service === 'resend') {
      existing.emailCount++
    } else if (log.service === 'pagespeed') {
      existing.psiCount++
    }

    orgMap.set(orgKey, existing)
  }

  // Fetch org names
  const orgIds = [...orgMap.keys()].filter((k) => k !== '__none__')
  const orgNames: Record<string, string> = {}
  if (orgIds.length > 0) {
    const { data: orgs } = await serviceClient
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)

    for (const org of orgs ?? []) {
      orgNames[org.id] = org.name
    }
  }

  const byOrganization: OrgUsage[] = [...orgMap.entries()]
    .map(([orgId, usage]) => ({
      organizationId: orgId === '__none__' ? null : orgId,
      organizationName: orgId === '__none__' ? '(Quick Audit)' : (orgNames[orgId] ?? 'Unknown'),
      ...usage,
    }))
    .sort((a, b) => b.anthropicTokens - a.anthropicTokens)

  return {
    totals: [...serviceTotals.values()],
    byOrganization,
  }
}
