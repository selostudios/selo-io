import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, FROM_EMAIL } from '@/lib/email/client'
import WeeklySummaryEmail from '@/emails/weekly-summary-email'

/**
 * Weekly marketing summary emails — sends a performance digest to
 * each organization's admin and team members.
 *
 * Scheduled: Monday 7 AM UTC via vercel.json cron
 */

// Key metrics to summarize per platform
const METRIC_LABELS: Record<string, string> = {
  linkedin_impressions: 'LinkedIn impressions',
  linkedin_followers: 'LinkedIn followers',
  linkedin_reactions: 'LinkedIn reactions',
  linkedin_page_views: 'LinkedIn page views',
  hubspot_total_contacts: 'HubSpot contacts',
  hubspot_new_deals: 'HubSpot new deals',
  hubspot_total_pipeline_value: 'HubSpot pipeline value',
  ga_sessions: 'GA sessions',
  ga_page_views: 'GA page views',
  ga_users: 'GA users',
}

// Cumulative metrics use latest value; others use sum
const CUMULATIVE_METRICS = new Set([
  'linkedin_followers',
  'hubspot_total_contacts',
  'hubspot_total_deals',
  'hubspot_total_pipeline_value',
])

function formatValue(metricType: string, value: number): string {
  if (metricType.includes('pipeline_value')) {
    return `$${(value / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  }
  return value.toLocaleString('en-US')
}

function generateBullets(
  currentMetrics: { metric_type: string; value: number }[],
  previousMetrics: { metric_type: string; value: number }[]
): string[] {
  const bullets: string[] = []

  // Aggregate by metric type
  const currentByType = new Map<string, number>()
  const previousByType = new Map<string, number>()

  for (const m of currentMetrics) {
    if (CUMULATIVE_METRICS.has(m.metric_type)) {
      // Use latest value (last entry wins since sorted by date asc)
      currentByType.set(m.metric_type, m.value)
    } else {
      currentByType.set(m.metric_type, (currentByType.get(m.metric_type) ?? 0) + m.value)
    }
  }

  for (const m of previousMetrics) {
    if (CUMULATIVE_METRICS.has(m.metric_type)) {
      previousByType.set(m.metric_type, m.value)
    } else {
      previousByType.set(m.metric_type, (previousByType.get(m.metric_type) ?? 0) + m.value)
    }
  }

  // Generate bullets for metrics that have data
  for (const [metricType, label] of Object.entries(METRIC_LABELS)) {
    const current = currentByType.get(metricType)
    if (current === undefined) continue

    const previous = previousByType.get(metricType)
    let bullet = `${label}: ${formatValue(metricType, current)}`

    if (previous !== undefined && previous > 0) {
      const change = ((current - previous) / previous) * 100
      const direction = change >= 0 ? '+' : ''
      bullet += ` (${direction}${change.toFixed(0)}% vs prior week)`
    }

    bullets.push(bullet)
  }

  if (bullets.length === 0) {
    bullets.push('No metrics data available for this week.')
  }

  return bullets
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all organizations with active platform connections
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name')
    .neq('status', 'inactive')

  if (orgsError || !orgs?.length) {
    console.error('[Weekly Summary]', {
      type: 'fetch_orgs_failed',
      error: orgsError?.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }

  // Date ranges: current week (Mon-Sun) and previous week
  const now = new Date()
  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(now.getDate() - now.getDay() - 6) // Last Monday
  currentWeekStart.setHours(0, 0, 0, 0)

  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6)

  const previousWeekStart = new Date(currentWeekStart)
  previousWeekStart.setDate(currentWeekStart.getDate() - 7)

  const previousWeekEnd = new Date(currentWeekStart)
  previousWeekEnd.setDate(currentWeekStart.getDate() - 1)

  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  const results = { sent: 0, skipped: 0, failed: 0 }

  for (const org of orgs) {
    try {
      // Fetch current and previous week metrics in parallel
      const [{ data: currentMetrics }, { data: previousMetrics }] = await Promise.all([
        supabase
          .from('campaign_metrics')
          .select('metric_type, value')
          .eq('organization_id', org.id)
          .gte('date', formatDate(currentWeekStart))
          .lte('date', formatDate(currentWeekEnd))
          .order('date', { ascending: true }),
        supabase
          .from('campaign_metrics')
          .select('metric_type, value')
          .eq('organization_id', org.id)
          .gte('date', formatDate(previousWeekStart))
          .lte('date', formatDate(previousWeekEnd))
          .order('date', { ascending: true }),
      ])

      if (!currentMetrics?.length) {
        results.skipped++
        continue
      }

      const bullets = generateBullets(currentMetrics, previousMetrics ?? [])
      const weekLabel = currentWeekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })

      // Get team members who should receive summaries (admins and team_members)
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('organization_id', org.id)
        .in('role', ['admin', 'team_member'])

      if (!members?.length) {
        results.skipped++
        continue
      }

      // Get emails from auth for these users
      const authResults = await Promise.all(
        members.map((m) => supabase.auth.admin.getUserById(m.user_id))
      )

      const emails = authResults
        .map((r) => r.data?.user?.email)
        .filter((e): e is string => Boolean(e))

      if (!emails.length) {
        results.skipped++
        continue
      }

      const dashboardLink = `${process.env.NEXT_PUBLIC_SITE_URL}/${org.id}/dashboard`

      // Send to each member
      for (const email of emails) {
        try {
          await sendEmail({
            from: FROM_EMAIL,
            to: email,
            subject: `Weekly Marketing Summary — ${org.name}`,
            react: WeeklySummaryEmail({
              organizationName: org.name,
              weekStartDate: weekLabel,
              summaryBullets: bullets,
              dashboardLink,
            }),
            idempotencyKey: `weekly-summary-${org.id}-${formatDate(currentWeekStart)}-${email}`,
            headers: {
              'List-Unsubscribe': `<mailto:${FROM_EMAIL}?subject=unsubscribe>`,
            },
          })
          results.sent++
        } catch {
          results.failed++
        }
      }
    } catch (err) {
      results.failed++
      console.error('[Weekly Summary]', {
        type: 'org_processing_failed',
        orgId: org.id,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      })
    }
  }

  console.error('[Weekly Summary]', {
    type: 'completed',
    ...results,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json(results)
}
