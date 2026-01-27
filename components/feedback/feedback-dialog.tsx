'use client'

import { useState, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFeedback } from './feedback-provider'
import { submitFeedback } from '@/app/feedback/actions'
import { CATEGORY_OPTIONS, FeedbackCategory } from '@/lib/types/feedback'
import { X, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Validation constants matching server-side requirements
const TITLE_MIN_LENGTH = 3
const TITLE_MAX_LENGTH = 200
const DESCRIPTION_MIN_LENGTH = 10

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? 'Submitting…' : 'Submit'}
    </Button>
  )
}

export function FeedbackDialog() {
  const { isOpen, closeFeedback } = useFeedback()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>(FeedbackCategory.Bug)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Validation state
  const isTitleValid = title.trim().length >= TITLE_MIN_LENGTH
  const isDescriptionValid = description.trim().length >= DESCRIPTION_MIN_LENGTH
  const isFormValid = isTitleValid && isDescriptionValid

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file',
          description: 'Please select an image file',
          variant: 'destructive',
        })
        return
      }
      setScreenshot(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const removeScreenshot = () => {
    setScreenshot(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (formData: FormData) => {
    formData.set('category', category)
    formData.set('page_url', window.location.href)
    formData.set('user_agent', navigator.userAgent)
    if (screenshot) {
      formData.set('screenshot', screenshot)
    }

    const result = await submitFeedback(formData)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Feedback submitted', description: 'Thank you for your feedback!' })
      closeFeedback()
      formRef.current?.reset()
      setTitle('')
      setDescription('')
      setCategory(FeedbackCategory.Bug)
      removeScreenshot()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeFeedback()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs, requesting features, or sharing feedback.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Brief summary of the issue"
              required
              minLength={TITLE_MIN_LENGTH}
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {title.length > 0 && !isTitleValid && (
              <p className="text-destructive text-sm">
                Title must be at least {TITLE_MIN_LENGTH} characters
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the issue in detail..."
              required
              minLength={DESCRIPTION_MIN_LENGTH}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {description.length > 0 && !isDescriptionValid && (
              <p className="text-destructive text-sm">
                Description must be at least {DESCRIPTION_MIN_LENGTH} characters
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as FeedbackCategory)}>
              <SelectTrigger id="category" data-testid="category-select">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Screenshot (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {previewUrl ? (
              <div className="relative rounded-md border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs cannot use next/image */}
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="max-h-32 rounded object-contain"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={removeScreenshot}
                  aria-label="Remove screenshot"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Screenshot
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeFeedback}>
              Cancel
            </Button>
            <SubmitButton disabled={!isFormValid} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
