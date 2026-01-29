'use client'

import { useState } from 'react'
import { Loader2, RotateCcw, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  updateReport,
  updateExecutiveSummary,
  restoreOriginalSummary,
} from '@/app/(authenticated)/seo/reports/actions'
import type { GeneratedReport } from '@/lib/reports/types'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: GeneratedReport
  onSaved?: () => void
}

export function SettingsDialog({ open, onOpenChange, report, onSaved }: SettingsDialogProps) {
  const [summary, setSummary] = useState(report.executive_summary ?? '')
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(
    !!(report.custom_logo_url || report.custom_company_name)
  )
  const [companyName, setCompanyName] = useState(report.custom_company_name ?? '')
  const [logoUrl, setLogoUrl] = useState(report.custom_logo_url ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasOriginalSummary = !!report.original_executive_summary
  const summaryModified = summary !== report.original_executive_summary

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      // Save summary if changed
      if (summary !== report.executive_summary) {
        const summaryResult = await updateExecutiveSummary(report.id, summary)
        if (!summaryResult.success) {
          setError(summaryResult.error ?? 'Failed to save summary')
          setIsSaving(false)
          return
        }
      }

      // Save white-label settings
      const whiteLabelResult = await updateReport(report.id, {
        custom_logo_url: whiteLabelEnabled ? logoUrl || null : null,
        custom_company_name: whiteLabelEnabled ? companyName || null : null,
      })

      if (!whiteLabelResult.success) {
        setError(whiteLabelResult.error ?? 'Failed to save settings')
        setIsSaving(false)
        return
      }

      onSaved?.()
      onOpenChange(false)
    } catch {
      setError('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestoreOriginal = async () => {
    if (!hasOriginalSummary) return

    setIsRestoring(true)
    setError(null)

    try {
      const result = await restoreOriginalSummary(report.id)
      if (result.success) {
        setSummary(report.original_executive_summary ?? '')
      } else {
        setError(result.error ?? 'Failed to restore summary')
      }
    } catch {
      setError('Failed to restore summary')
    } finally {
      setIsRestoring(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset to original values after animation
    setTimeout(() => {
      setSummary(report.executive_summary ?? '')
      setWhiteLabelEnabled(!!(report.custom_logo_url || report.custom_company_name))
      setCompanyName(report.custom_company_name ?? '')
      setLogoUrl(report.custom_logo_url ?? '')
      setError(null)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report Settings</DialogTitle>
          <DialogDescription>
            Customize the executive summary and branding for this report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Executive Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="summary">Executive Summary</Label>
              {hasOriginalSummary && summaryModified && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRestoreOriginal}
                  disabled={isRestoring}
                  className="text-muted-foreground h-auto px-2 py-1 text-xs"
                >
                  {isRestoring ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-3 w-3" />
                  )}
                  Restore Original
                </Button>
              )}
            </div>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={6}
              placeholder="Enter executive summary..."
              className="resize-none"
            />
            <p className="text-muted-foreground text-xs">
              This summary appears on the Executive Summary slide of the report.
            </p>
          </div>

          <Separator />

          {/* White Label */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="whitelabel"
                checked={whiteLabelEnabled}
                onCheckedChange={(checked) => setWhiteLabelEnabled(checked === true)}
              />
              <Label htmlFor="whitelabel" className="cursor-pointer font-medium">
                Use custom branding
              </Label>
            </div>

            {whiteLabelEnabled && (
              <div className="space-y-4 pl-6">
                {/* Logo URL */}
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="logoUrl"
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setLogoUrl('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {logoUrl && (
                    <div className="mt-2 rounded border p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- User-provided external URL, can't configure all domains */}
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="h-8 max-w-[200px] object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your Agency Name"
                  />
                </div>

                <p className="text-muted-foreground text-xs">
                  Custom branding replaces Selo Studios branding on the cover and closing slides.
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
