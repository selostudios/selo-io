'use client'

import { useState, useRef } from 'react'
import { uploadLogo, removeLogo } from '@/app/(authenticated)/settings/organization/actions'
import { Button } from '@/components/ui/button'
import { showSuccess, showError } from '@/components/ui/sonner'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface LogoUploadProps {
  currentLogoUrl: string | null
  organizationName: string
  primaryColor: string
}

export function LogoUpload({ currentLogoUrl, organizationName, primaryColor }: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl)
  const [dialogOpen, setDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const initial = organizationName.charAt(0).toUpperCase()

  async function handleFileSelect(file: File) {
    // Client-side validation
    const MAX_SIZE = 2 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      showError('File size must be less than 2MB')
      return
    }

    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!ALLOWED_TYPES.includes(file.type)) {
      showError('File must be PNG, JPG, or SVG')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await uploadLogo(formData)

      if (result.error) {
        showError(result.error)
      } else if (result.logoUrl) {
        setPreviewUrl(result.logoUrl)
        showSuccess('Logo uploaded successfully!')
        setDialogOpen(false)
        router.refresh()
      }
    } catch {
      console.error('[LogoUpload Error]', {
        type: 'upload_failed',
        timestamp: new Date().toISOString(),
      })
      showError('An unexpected error occurred. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemove() {
    setIsRemoving(true)

    try {
      const result = await removeLogo()

      if (result.error) {
        showError(result.error)
      } else {
        setPreviewUrl(null)
        showSuccess('Logo removed successfully!')
        setDialogOpen(false)
        router.refresh()
      }
    } catch {
      console.error('[LogoUpload Error]', {
        type: 'remove_failed',
        timestamp: new Date().toISOString(),
      })
      showError('An unexpected error occurred. Please try again.')
    } finally {
      setIsRemoving(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
    e.target.value = '' // Reset to allow re-selecting the same file
  }

  return (
    <>
      {/* Compact View */}
      <div className="flex items-center gap-4">
        {/* Logo Preview */}
        {previewUrl ? (
          <div
            className="shrink-0 overflow-hidden rounded-lg"
            style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px' }}
          >
            <Image
              src={previewUrl}
              alt="Organization logo"
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            role="img"
            aria-label={`${organizationName} logo placeholder`}
            className="flex shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
            style={{
              backgroundColor: primaryColor || '#6B7280',
              width: '48px',
              height: '48px',
              minWidth: '48px',
              minHeight: '48px',
            }}
          >
            {initial}
          </div>
        )}

        {/* Edit/Add Button */}
        <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          {previewUrl ? 'Edit' : 'Add Logo'}
        </Button>
      </div>

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organization Logo</DialogTitle>
            <DialogDescription>
              Upload a logo for your organization. PNG, JPG, or SVG. Max 2MB.
            </DialogDescription>
          </DialogHeader>

          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragOver ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
            } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            tabIndex={0}
            role="button"
            aria-label="Upload logo. Drop a file here or press Enter to browse."
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <div className="flex flex-col items-center gap-4">
              {/* Preview */}
              <div className="relative">
                {previewUrl ? (
                  <div className="h-20 w-20 overflow-hidden rounded-lg">
                    <Image
                      src={previewUrl}
                      alt="Organization logo"
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    role="img"
                    aria-label={`${organizationName} logo placeholder`}
                    className="flex h-20 w-20 items-center justify-center rounded-lg text-2xl font-bold text-white"
                    style={{ backgroundColor: primaryColor || '#6B7280' }}
                  >
                    {initial}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <p className="text-sm text-neutral-600">
                {isUploading ? 'Uploading…' : 'Drag and drop your logo here, or click to browse'}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isRemoving}
                >
                  {isUploading ? 'Uploading…' : 'Choose File'}
                </Button>
                {previewUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemove}
                    disabled={isUploading || isRemoving}
                    className="text-red-600 hover:text-red-700"
                  >
                    {isRemoving ? 'Removing…' : 'Remove'}
                  </Button>
                )}
              </div>
            </div>

            <label htmlFor="logo-file-input" className="sr-only">
              Choose logo file
            </label>
            <input
              ref={fileInputRef}
              id="logo-file-input"
              type="file"
              accept=".png,.jpg,.jpeg,.svg"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
