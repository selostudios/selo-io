'use client'

import { useState } from 'react'
import { Copy, Check, Loader2, Link as LinkIcon, Lock, Eye } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ShareExpiration } from '@/lib/enums'
import type { SharedResourceType } from '@/lib/enums'
import { createSharedLink } from '@/lib/share/actions'
import { getResourceTypeLabel } from '@/lib/share/utils'
import type { SharedLink } from '@/lib/share/types'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceType: SharedResourceType
  resourceId: string
}

export function ShareModal({ open, onOpenChange, resourceType, resourceId }: ShareModalProps) {
  const [expiration, setExpiration] = useState<ShareExpiration>(ShareExpiration.ThirtyDays)
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined)
  const [maxViews, setMaxViews] = useState(50)
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [password, setPassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createdShare, setCreatedShare] = useState<{ share: SharedLink; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = getResourceTypeLabel(resourceType)

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)

    try {
      const result = await createSharedLink({
        resource_type: resourceType,
        resource_id: resourceId,
        expires_in: expiration,
        custom_expiration:
          expiration === ShareExpiration.Custom && customDate
            ? customDate.toISOString()
            : undefined,
        password: passwordEnabled ? password : undefined,
        max_views: maxViews,
      })

      if (result.success && result.share && result.shareUrl) {
        setCreatedShare({ share: result.share, url: result.shareUrl })
      } else {
        setError(result.error ?? 'Failed to create share link')
      }
    } catch {
      setError('Failed to create share link')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!createdShare) return

    try {
      await navigator.clipboard.writeText(createdShare.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = createdShare.url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setCreatedShare(null)
      setError(null)
      setExpiration(ShareExpiration.ThirtyDays)
      setCustomDate(undefined)
      setMaxViews(50)
      setPasswordEnabled(false)
      setPassword('')
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {label}</DialogTitle>
          <DialogDescription>
            Create a shareable link for this {label.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        {!createdShare ? (
          <div className="space-y-6">
            {/* Expiration */}
            <div className="space-y-2">
              <Label>Expires after</Label>
              <Select value={expiration} onValueChange={(v) => setExpiration(v as ShareExpiration)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ShareExpiration.SevenDays}>7 days</SelectItem>
                  <SelectItem value={ShareExpiration.ThirtyDays}>30 days</SelectItem>
                  <SelectItem value={ShareExpiration.NinetyDays}>90 days</SelectItem>
                  <SelectItem value={ShareExpiration.Custom}>Custom...</SelectItem>
                </SelectContent>
              </Select>

              {expiration === ShareExpiration.Custom && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customDate && 'text-muted-foreground'
                      )}
                    >
                      {customDate ? format(customDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDate}
                      onSelect={setCustomDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* View Limit */}
            <div className="space-y-2">
              <Label htmlFor="maxViews">View limit</Label>
              <div className="flex items-center gap-2">
                <Eye className="text-muted-foreground h-4 w-4" />
                <Input
                  id="maxViews"
                  type="number"
                  min={1}
                  max={1000}
                  value={maxViews}
                  onChange={(e) => setMaxViews(parseInt(e.target.value) || 50)}
                  className="w-24"
                />
                <span className="text-muted-foreground text-sm">views</span>
              </div>
            </div>

            {/* Password Protection */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="password"
                  checked={passwordEnabled}
                  onCheckedChange={(checked) => setPasswordEnabled(checked === true)}
                />
                <Label htmlFor="password" className="cursor-pointer">
                  Password protect
                </Label>
              </div>

              {passwordEnabled && (
                <div className="flex items-center gap-2">
                  <Lock className="text-muted-foreground h-4 w-4" />
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              onClick={handleCreate}
              disabled={isCreating || (expiration === ShareExpiration.Custom && !customDate)}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Create Share Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success state */}
            <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950/30">
              <Check className="mx-auto mb-2 h-8 w-8 text-green-600 dark:text-green-400" />
              <p className="font-medium text-green-800 dark:text-green-200">Link created!</p>
            </div>

            {/* URL display */}
            <div className="flex items-center gap-2">
              <Input readOnly value={createdShare.url} className="bg-muted font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy} className="flex-shrink-0">
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Link details */}
            <div className="text-muted-foreground text-sm">
              <p>Expires: {format(new Date(createdShare.share.expires_at), 'PPP')}</p>
              <p>Max views: {createdShare.share.max_views}</p>
              {createdShare.share.has_password && (
                <p className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Password protected
                </p>
              )}
            </div>

            <Button onClick={handleClose} variant="outline" className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
