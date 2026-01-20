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
import { CATEGORY_OPTIONS, type FeedbackCategory } from '@/lib/types/feedback'
import { X, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </Button>
  )
}

export function FeedbackDialog() {
  const { isOpen, closeFeedback } = useFeedback()
  const { toast } = useToast()
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

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
      setCategory('bug')
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
              minLength={3}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe the issue in detail..."
              required
              minLength={10}
              rows={4}
            />
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
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
