'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { MonitoredSite } from '@/lib/performance/types'
import { formatDate } from '@/lib/utils'

interface MonitoredSitesManagerProps {
  sites: MonitoredSite[]
  websiteUrl: string | null
}

export function MonitoredSitesManager({
  sites: initialSites,
  websiteUrl,
}: MonitoredSitesManagerProps) {
  const [sites, setSites] = useState(initialSites)
  const [isAdding, setIsAdding] = useState(false)

  const currentSite = sites.find((s) => s.url === websiteUrl)

  const handleAddSite = async () => {
    if (!websiteUrl) return
    setIsAdding(true)

    try {
      const response = await fetch('/api/settings/monitored-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      })

      if (response.ok) {
        const site = await response.json()
        setSites((prev) => [...prev, site])
      }
    } catch (err) {
      console.error('Failed to add site:', err)
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggle = async (
    siteId: string,
    field: 'run_site_audit' | 'run_performance_audit',
    value: boolean
  ) => {
    try {
      await fetch('/api/settings/monitored-sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: siteId, [field]: value }),
      })

      setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, [field]: value } : s)))
    } catch (err) {
      console.error('Failed to update site:', err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Automated Audits</CardTitle>
        <CardDescription>
          Configure automatic weekly audits for your site. Audits run every Sunday at 2am UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentSite && websiteUrl && (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-muted-foreground mb-2 text-sm">
              Enable weekly automated audits for {websiteUrl}
            </p>
            <Button onClick={handleAddSite} disabled={isAdding}>
              {isAdding ? 'Enabling...' : 'Enable Weekly Audits'}
            </Button>
          </div>
        )}

        {!websiteUrl && (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-muted-foreground text-sm">
              No website URL configured. Please add your website URL in Organization settings first.
            </p>
          </div>
        )}

        {currentSite && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="font-medium">{currentSite.url}</div>

            <div className="flex items-center justify-between">
              <Label htmlFor="site-audit" className="flex flex-col gap-1">
                <span>Site Audit (SEO/AIO)</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {currentSite.last_site_audit_at
                    ? `Last run: ${formatDate(currentSite.last_site_audit_at, false)}`
                    : 'Never run'}
                </span>
              </Label>
              <Switch
                id="site-audit"
                checked={currentSite.run_site_audit}
                onCheckedChange={(v) => handleToggle(currentSite.id, 'run_site_audit', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="perf-audit" className="flex flex-col gap-1">
                <span>Performance Audit</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {currentSite.last_performance_audit_at
                    ? `Last run: ${formatDate(currentSite.last_performance_audit_at, false)}`
                    : 'Never run'}
                </span>
              </Label>
              <Switch
                id="perf-audit"
                checked={currentSite.run_performance_audit}
                onCheckedChange={(v) => handleToggle(currentSite.id, 'run_performance_audit', v)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
