'use client'

import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ConnectionStatus } from '@/lib/enums'
import {
  Bot,
  Mail,
  Gauge,
  Calendar,
  RefreshCw,
  Info,
  MessageSquare,
  Search,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { getUsageSummary } from './actions'

interface HealthStatus {
  service: string
  name: string
  status: 'healthy' | 'unconfigured' | 'inactive' | 'error'
  lastActivity: string | null
  hint: string | null
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

interface SystemClientProps {
  health: HealthStatus[]
  initialUsage: UsageSummary
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  anthropic: Bot,
  openai: MessageSquare,
  perplexity: Search,
  resend: Mail,
  pagespeed: Gauge,
  weekly_audits: Calendar,
  daily_metrics: RefreshCw,
}

const STATUS_CONFIG = {
  healthy: { color: 'bg-green-500', label: 'Healthy' },
  error: { color: 'bg-red-500', label: 'Error' },
  inactive: { color: 'bg-yellow-500', label: 'Inactive' },
  unconfigured: { color: 'bg-gray-400', label: ConnectionStatus.NotConnected },
} as const

export function SystemClient({ health, initialUsage }: SystemClientProps) {
  const [usage, setUsage] = useState<UsageSummary>(initialUsage)
  const [period, setPeriod] = useState<'month' | '30d' | '7d'>('month')
  const [isPending, startTransition] = useTransition()

  function handlePeriodChange(value: string) {
    const newPeriod = value as 'month' | '30d' | '7d'
    setPeriod(newPeriod)
    startTransition(async () => {
      const result = await getUsageSummary(newPeriod)
      if (!('error' in result)) {
        setUsage(result)
      }
    })
  }

  const anthropicTotal = usage.totals.find((t) => t.service === 'anthropic')
  const resendTotal = usage.totals.find((t) => t.service === 'resend')
  const psiTotal = usage.totals.find((t) => t.service === 'pagespeed')

  const totalAnthropicTokens = anthropicTotal
    ? anthropicTotal.totalTokensInput + anthropicTotal.totalTokensOutput
    : 0

  return (
    <div className="space-y-8">
      {/* Health Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Service Health</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {health.map((item) => {
            const Icon = SERVICE_ICONS[item.service]
            const statusConfig = STATUS_CONFIG[item.status]

            return (
              <Card key={item.service} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="text-muted-foreground h-4 w-4" />}
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.hint && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="text-muted-foreground h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-64">
                          {item.hint}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <div className={`h-2 w-2 rounded-full ${statusConfig.color}`} />
                    <span className="text-muted-foreground text-xs">{statusConfig.label}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {item.lastActivity
                      ? `Last used ${formatDistanceToNow(new Date(item.lastActivity), { addSuffix: true })}`
                      : 'Never used'}
                  </p>
                  {item.service === 'anthropic' && item.status !== 'unconfigured' && (
                    <a
                      href="https://console.anthropic.com/settings/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs underline"
                    >
                      Manage Plan
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Usage Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">API Usage</h2>
          <Tabs value={period} onValueChange={handlePeriodChange}>
            <TabsList>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="30d">Last 30 Days</TabsTrigger>
              <TabsTrigger value="7d">Last 7 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary Cards */}
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${isPending ? 'opacity-50' : ''}`}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Anthropic</CardDescription>
              <CardTitle className="text-2xl">{formatTokens(totalAnthropicTokens)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">
                Estimated cost: {formatCost(anthropicTotal?.estimatedCost ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Emails</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(resendTotal?.callCount ?? 0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">Sent via Resend</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>PageSpeed Insights</CardDescription>
              <CardTitle className="text-2xl">{formatNumber(psiTotal?.callCount ?? 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">API calls</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-org Table */}
        <Card className={isPending ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Usage by Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">AI Tokens</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead className="text-right">Emails</TableHead>
                  <TableHead className="text-right">PageSpeed Insights</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.byOrganization.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No usage data for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {usage.byOrganization.map((org) => (
                      <TableRow key={org.organizationId ?? '__none__'}>
                        <TableCell>
                          {org.organizationId === null ? (
                            <span className="text-muted-foreground italic">
                              {org.organizationName}
                            </span>
                          ) : (
                            org.organizationName
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(org.anthropicTokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCost(org.anthropicCost)}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(org.emailCount)}</TableCell>
                        <TableCell className="text-right">{formatNumber(org.psiCount)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(
                          usage.byOrganization.reduce((sum, o) => sum + o.anthropicTokens, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCost(
                          usage.byOrganization.reduce((sum, o) => sum + o.anthropicCost, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(
                          usage.byOrganization.reduce((sum, o) => sum + o.emailCount, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(usage.byOrganization.reduce((sum, o) => sum + o.psiCount, 0))}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
