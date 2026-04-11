'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateAIVisibilityConfig } from '@/app/(authenticated)/[orgId]/ai-visibility/actions'
import { AIPlatform, SyncFrequency } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES } from '@/lib/ai-visibility/types'
import type { AIVisibilityConfig } from '@/lib/ai-visibility/types'

interface ConfigFormProps {
  orgId: string
  config: AIVisibilityConfig | null
  availablePlatforms: AIPlatform[]
}

const FREQUENCY_LABELS: Record<SyncFrequency, string> = {
  [SyncFrequency.Daily]: 'Daily',
  [SyncFrequency.Weekly]: 'Weekly',
  [SyncFrequency.Monthly]: 'Monthly',
}

export function AIVisibilityConfigForm({ orgId, config, availablePlatforms }: ConfigFormProps) {
  const [isPending, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(config?.is_active ?? false)
  const [platforms, setPlatforms] = useState<AIPlatform[]>(config?.platforms ?? availablePlatforms)
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>(
    (config?.sync_frequency as SyncFrequency) ?? SyncFrequency.Daily
  )
  const [budgetDollars, setBudgetDollars] = useState(
    ((config?.monthly_budget_cents ?? 10000) / 100).toString()
  )
  const [alertThreshold, setAlertThreshold] = useState(
    (config?.budget_alert_threshold ?? 90).toString()
  )
  const [competitors, setCompetitors] = useState<{ name: string; domain: string }[]>(
    config?.competitors ?? []
  )

  const togglePlatform = (platform: AIPlatform) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  const addCompetitor = () => {
    if (competitors.length >= 10) return
    setCompetitors([...competitors, { name: '', domain: '' }])
  }

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index))
  }

  const updateCompetitor = (index: number, field: 'name' | 'domain', value: string) => {
    const updated = [...competitors]
    updated[index] = { ...updated[index], [field]: value }
    setCompetitors(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateAIVisibilityConfig(orgId, {
        isActive,
        platforms,
        syncFrequency,
        monthlyBudgetCents: Math.round(parseFloat(budgetDollars || '0') * 100),
        budgetAlertThreshold: parseInt(alertThreshold || '90', 10),
        competitors: competitors.filter((c) => c.name.trim()),
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('AI Visibility configuration saved')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Visibility</CardTitle>
        <CardDescription>Configure how Selo tracks your brand across AI platforms.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable AI Visibility</Label>
              <p className="text-muted-foreground text-sm">
                Automatically sync brand mentions from AI platforms
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-4">
              {availablePlatforms.map((platform) => (
                <label key={platform} className="flex items-center gap-2">
                  <Checkbox
                    checked={platforms.includes(platform)}
                    onCheckedChange={() => togglePlatform(platform)}
                  />
                  <span className="text-sm">{PLATFORM_DISPLAY_NAMES[platform]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sync Frequency */}
          <div className="space-y-2">
            <Label>Sync Frequency</Label>
            <Select
              value={syncFrequency}
              onValueChange={(v) => setSyncFrequency(v as SyncFrequency)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SyncFrequency).map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {FREQUENCY_LABELS[freq]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Monthly Budget</Label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  $
                </span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={budgetDollars}
                  onChange={(e) => setBudgetDollars(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alert Threshold</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="pr-8"
                />
                <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Competitors */}
          <div className="space-y-3">
            <Label>Competitors</Label>
            {competitors.map((competitor, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Name"
                  value={competitor.name}
                  onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="domain.com"
                  value={competitor.domain}
                  onChange={(e) => updateCompetitor(index, 'domain', e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCompetitor(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {competitors.length < 10 && (
              <Button type="button" variant="outline" size="sm" onClick={addCompetitor}>
                <Plus className="mr-2 h-4 w-4" />
                Add Competitor
              </Button>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
