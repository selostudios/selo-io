'use client'

import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateUtmParameters } from '@/app/(authenticated)/dashboard/campaigns/actions'
import { showSuccess, showError } from '@/components/ui/sonner'
import { useRouter } from 'next/navigation'

const MEDIUM_OPTIONS = [
  { value: 'email', description: 'Email campaigns, newsletters' },
  { value: 'social', description: 'Organic social media posts' },
  { value: 'cpc', description: 'Paid ads (cost-per-click)' },
  { value: 'display', description: 'Banner/display ads' },
  { value: 'referral', description: 'Partner/referral links' },
  { value: 'organic', description: 'Organic search' },
]

const UTM_FIELDS = [
  {
    key: 'utm_source',
    label: 'utm_source',
    description:
      'Identifies which site or platform sent the traffic. Example: linkedin, facebook, newsletter, google',
  },
  {
    key: 'utm_medium',
    label: 'utm_medium',
    description:
      'Identifies the marketing medium or channel type. Example: social, email, cpc, display, organic',
  },
  {
    key: 'utm_campaign',
    label: 'utm_campaign',
    description:
      'Identifies the specific campaign name or promotion. Example: spring-sale-2026, product-launch-q1',
  },
  {
    key: 'utm_term',
    label: 'utm_term',
    description:
      'Identifies target audience, keywords, or ad groups. Example: cmo-audience, marketing-managers, uk-enterprise',
  },
  {
    key: 'utm_content',
    label: 'utm_content',
    description:
      'Differentiates similar content for A/B testing, format, or placement. Example: video-testimonial, carousel-a, header-cta',
  },
] as const

interface UtmValues {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
}

interface EditableUtmSectionProps {
  campaignId: string
  initialValues: UtmValues
}

export function EditableUtmSection({ campaignId, initialValues }: EditableUtmSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [values, setValues] = useState<UtmValues>(initialValues)
  const router = useRouter()

  const hasChanges =
    values.utm_source !== initialValues.utm_source ||
    values.utm_medium !== initialValues.utm_medium ||
    values.utm_campaign !== initialValues.utm_campaign ||
    values.utm_term !== initialValues.utm_term ||
    values.utm_content !== initialValues.utm_content

  function handleCancel() {
    setValues(initialValues)
    setIsEditing(false)
  }

  async function handleSave() {
    setIsSaving(true)
    const result = await updateUtmParameters(campaignId, values)
    setIsSaving(false)

    if ('error' in result) {
      showError(result.error)
    } else {
      showSuccess('UTM parameters updated')
      setIsEditing(false)
      router.refresh()
    }
  }

  function renderField(field: (typeof UTM_FIELDS)[number]) {
    const value = values[field.key]
    const selectedOption =
      field.key === 'utm_medium' ? MEDIUM_OPTIONS.find((opt) => opt.value === value) : null

    if (!isEditing) {
      // Display mode
      return (
        <div key={field.key} className="flex items-center overflow-hidden rounded-l bg-neutral-50">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">
                  {field.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                <p>{field.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-1 px-3 py-2">
            <span className="font-mono text-sm" style={{ color: value ? '#171717' : '#9ca3af' }}>
              {value || 'Not set'}
            </span>
            {selectedOption && (
              <span className="text-muted-foreground ml-2 text-sm">
                - {selectedOption.description}
              </span>
            )}
          </div>
        </div>
      )
    }

    // Edit mode
    if (field.key === 'utm_medium') {
      return (
        <div key={field.key} className="flex items-center overflow-hidden rounded-l bg-neutral-50">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">
                  {field.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                <p>{field.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Select value={value} onValueChange={(val) => setValues({ ...values, utm_medium: val })}>
            <SelectTrigger className="flex-1 rounded-none border-0 shadow-none focus:ring-0">
              <SelectValue>
                <span className="font-mono" style={{ color: value ? '#171717' : '#9ca3af' }}>
                  {value || 'Not set'}
                </span>
                {selectedOption && (
                  <span className="text-muted-foreground ml-2">- {selectedOption.description}</span>
                )}
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
        </div>
      )
    }

    return (
      <div key={field.key} className="flex items-center overflow-hidden rounded-l bg-neutral-50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="bg-neutral-700 px-4 py-3 font-mono text-sm text-white">
                {field.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
              <p>{field.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Input
          value={value}
          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
          className="flex-1 rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
          style={{ color: value ? '#171717' : '#9ca3af' }}
          placeholder="Not set"
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">UTM Parameters</h3>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">{UTM_FIELDS.map(renderField)}</div>

      <p className="text-muted-foreground mt-4 text-sm">
        Use these parameters when creating content in HubSpot, LinkedIn, and other platforms.
      </p>
    </div>
  )
}
