'use client'

import { useState, useRef } from 'react'
import { uploadLogo, removeLogo } from '@/app/settings/organization/actions'
import { Button } from '@/components/ui/button'
import { showSuccess, showError } from '@/components/ui/sonner'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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

    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadLogo(formData)

    if (result.error) {
      showError(result.error)
    } else if (result.logoUrl) {
      setPreviewUrl(result.logoUrl)
      showSuccess('Logo uploaded successfully!')
      router.refresh()
    }

    setIsUploading(false)
  }

  async function handleRemove() {
    setIsRemoving(true)

    const result = await removeLogo()

    if (result.error) {
      showError(result.error)
    } else {
      setPreviewUrl(null)
      showSuccess('Logo removed successfully!')
      router.refresh()
    }

    setIsRemoving(false)
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
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Preview */}
          <div className="relative">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="Organization logo"
                width={80}
                height={80}
                className="rounded-lg object-contain"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-lg flex items-center justify-center text-2xl font-bold text-white"
                style={{ backgroundColor: primaryColor || '#6B7280' }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <p className="text-sm text-neutral-600">
              {isUploading ? 'Uploading...' : 'Drag and drop your logo here, or click to browse'}
            </p>
            <p className="text-xs text-neutral-400">
              PNG, JPG, or SVG. Max 2MB.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isRemoving}
            >
              {isUploading ? 'Uploading...' : 'Choose File'}
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
                {isRemoving ? 'Removing...' : 'Remove'}
              </Button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
