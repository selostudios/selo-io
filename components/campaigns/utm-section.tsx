'use client'

import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { showSuccess, showError } from '@/components/ui/sonner'
import { updateUtmParameters } from '@/app/dashboard/campaigns/actions'
import { useRouter } from 'next/navigation'

const MEDIUM_OPTIONS = [
  { value: 'email', description: 'Email campaigns, newsletters' },
  { value: 'social', description: 'Organic social media posts' },
  { value: 'cpc', description: 'Paid ads (cost-per-click)' },
  { value: 'display', description: 'Banner/display ads' },
  { value: 'referral', description: 'Partner/referral links' },
  { value: 'organic', description: 'Organic search' },
]

const UTM_DESCRIPTIONS = {
  utm_source:
    'Identifies which site or platform sent the traffic. Example: linkedin, facebook, newsletter, google',
  utm_medium:
    'Identifies the marketing medium or channel type. Example: social, email, cpc, display, organic',
  utm_campaign:
    'Identifies the specific campaign name or promotion. Example: spring-sale-2026, product-launch-q1',
  utm_term:
    'Identifies target audience, keywords, or ad groups. Example: cmo-audience, marketing-managers, uk-enterprise',
  utm_content:
    'Differentiates similar content for A/B testing, format, or placement. Example: video-testimonial, carousel-a, header-cta',
}

interface UtmSectionProps {
  campaignId: string
  initialValues: {
    utm_source: string
    utm_medium: string
    utm_campaign: string
    utm_term: string
    utm_content: string
  }
}

export function UtmSection({ campaignId, initialValues }: UtmSectionProps) {
  const [values, setValues] = useState(initialValues)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const hasChanges =
    values.utm_source !== initialValues.utm_source ||
    values.utm_medium !== initialValues.utm_medium ||
    values.utm_campaign !== initialValues.utm_campaign ||
    values.utm_term !== initialValues.utm_term ||
    values.utm_content !== initialValues.utm_content

  async function handleSave() {
    setIsSaving(true)
    const result = await updateUtmParameters(campaignId, values)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('UTM parameters saved')
      router.refresh()
    }
    setIsSaving(false)
  }

  async function handleCopy(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    showSuccess(`Copied ${label} to clipboard`)
  }

  function renderRow(
    label: keyof typeof UTM_DESCRIPTIONS,
    value: string,
    onChange: (val: string) => void,
    isSelect = false
  ) {
    return (
      <div className="flex items-center justify-between overflow-hidden rounded-l bg-neutral-50">
        <div className="flex flex-1 items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">
                  {label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                <p>{UTM_DESCRIPTIONS[label]}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {isSelect ? (
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger className="flex-1 rounded-none border-0 shadow-none">
                <SelectValue>
                  <span className="font-mono" style={{ color: value ? '#171717' : '#9ca3af' }}>
                    {value || 'Not set'}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MEDIUM_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="font-mono" style={{ color: '#171717' }}>
                      {option.value}
                    </span>
                    <span className="text-muted-foreground ml-2">- {option.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 rounded-none border-0 font-mono shadow-none"
              style={{ color: value ? '#171717' : '#9ca3af' }}
              placeholder="Not set"
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleCopy(label, value)}
          className="mr-2 h-8 w-8 p-0"
        >
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copy {label}</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {renderRow('utm_source', values.utm_source, (val) =>
        setValues((prev) => ({ ...prev, utm_source: val }))
      )}
      {renderRow(
        'utm_medium',
        values.utm_medium,
        (val) => setValues((prev) => ({ ...prev, utm_medium: val })),
        true
      )}
      {renderRow('utm_campaign', values.utm_campaign, (val) =>
        setValues((prev) => ({ ...prev, utm_campaign: val }))
      )}
      {renderRow('utm_term', values.utm_term, (val) =>
        setValues((prev) => ({ ...prev, utm_term: val }))
      )}
      {renderRow('utm_content', values.utm_content, (val) =>
        setValues((prev) => ({ ...prev, utm_content: val }))
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
