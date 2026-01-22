'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { SocialIcon } from '@/components/icons/social-icons'
import type { BrandData } from '@/lib/brandfetch/types'

interface BrandFetchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandData: BrandData
  onApply: (selections: BrandSelections) => void
}

export interface BrandSelections {
  logo: boolean
  colors: boolean
  description: boolean
  socialLinks: boolean
  location: boolean
}

export function BrandFetchModal({ open, onOpenChange, brandData, onApply }: BrandFetchModalProps) {
  const [selections, setSelections] = useState<BrandSelections>({
    logo: !!brandData.logo,
    colors: !!(brandData.colors.primary || brandData.colors.secondary || brandData.colors.accent),
    description: !!brandData.description,
    socialLinks: brandData.socialLinks.length > 0,
    location: !!(brandData.location.city || brandData.location.country),
  })

  const hasAnySelection = Object.values(selections).some(Boolean)

  function toggleSelection(key: keyof BrandSelections) {
    setSelections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleApply() {
    onApply(selections)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Brand Assets Found</DialogTitle>
          <DialogDescription>
            {brandData.name || 'Unknown Brand'} - Select which assets to apply
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Logo */}
          {brandData.logo && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="logo"
                checked={selections.logo}
                onCheckedChange={() => toggleSelection('logo')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="logo" className="cursor-pointer font-medium">
                  Logo
                </Label>
                <div className="bg-muted flex h-16 items-center justify-center rounded-md p-2">
                  <Image
                    src={brandData.logo.url}
                    alt="Brand logo"
                    width={120}
                    height={48}
                    className="max-h-12 w-auto object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          )}

          {/* Colors */}
          {(brandData.colors.primary || brandData.colors.secondary || brandData.colors.accent) && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="colors"
                checked={selections.colors}
                onCheckedChange={() => toggleSelection('colors')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="colors" className="cursor-pointer font-medium">
                  Colors
                </Label>
                <div className="flex gap-2">
                  {brandData.colors.primary && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: brandData.colors.primary }}
                      />
                      <span className="font-mono text-xs">{brandData.colors.primary}</span>
                    </div>
                  )}
                  {brandData.colors.secondary && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: brandData.colors.secondary }}
                      />
                      <span className="font-mono text-xs">{brandData.colors.secondary}</span>
                    </div>
                  )}
                  {brandData.colors.accent && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: brandData.colors.accent }}
                      />
                      <span className="font-mono text-xs">{brandData.colors.accent}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {brandData.description && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="description"
                checked={selections.description}
                onCheckedChange={() => toggleSelection('description')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="description" className="cursor-pointer font-medium">
                  Description
                </Label>
                <p className="text-muted-foreground text-sm">{brandData.description}</p>
              </div>
            </div>
          )}

          {/* Social Links */}
          {brandData.socialLinks.length > 0 && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="socialLinks"
                checked={selections.socialLinks}
                onCheckedChange={() => toggleSelection('socialLinks')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="socialLinks" className="cursor-pointer font-medium">
                  Social Links
                </Label>
                <div className="flex flex-wrap gap-2">
                  {brandData.socialLinks.map((link) => (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                    >
                      <SocialIcon platform={link.platform} className="h-4 w-4" />
                      <span className="capitalize">{link.platform}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          {(brandData.location.city || brandData.location.country) && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="location"
                checked={selections.location}
                onCheckedChange={() => toggleSelection('location')}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="location" className="cursor-pointer font-medium">
                  Location
                </Label>
                <p className="text-muted-foreground text-sm">
                  {[brandData.location.city, brandData.location.country].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasAnySelection}>
            Apply Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
