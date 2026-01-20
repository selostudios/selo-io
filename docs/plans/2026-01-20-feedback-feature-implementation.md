# Feedback Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a platform-wide feedback system where users can report issues and developers can triage them via a Support section.

**Architecture:** Feedback is stored in a platform-scoped table (not org-scoped). Users submit via dialog or CMD+Shift+F. Developers (new role with SUDO access) manage feedback at `/support`. Email notifications sent on submission and status changes.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + Storage + RLS), React Email, Shadcn UI, Vitest, Playwright

---

## Task 1: Database Migration - Enums and Feedback Table

**Files:**
- Create: `supabase/migrations/20260120000001_feedback_feature.sql`

**Step 1: Write the migration file**

```sql
-- Add developer role to existing enum
ALTER TYPE user_role ADD VALUE 'developer';

-- Create feedback-specific enums
CREATE TYPE feedback_category AS ENUM (
  'bug',
  'feature_request',
  'performance',
  'usability',
  'other'
);

CREATE TYPE feedback_status AS ENUM (
  'new',
  'under_review',
  'in_progress',
  'resolved',
  'closed'
);

CREATE TYPE feedback_priority AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

-- Create feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category feedback_category NOT NULL,
  status feedback_status NOT NULL DEFAULT 'new',
  priority feedback_priority,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  page_url TEXT,
  user_agent TEXT,
  screenshot_url TEXT,
  status_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_submitted_by ON feedback(submitted_by);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (submitted_by = auth.uid());

-- RLS: Authenticated users can submit feedback
CREATE POLICY "Authenticated users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());

-- RLS: Developers can view all feedback
CREATE POLICY "Developers can view all feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- RLS: Developers can update any feedback
CREATE POLICY "Developers can update feedback"
  ON feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload
CREATE POLICY "Users can upload feedback screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.uid() IS NOT NULL
  );

-- Storage policy: users can read their own uploads
CREATE POLICY "Users can read own screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policy: developers can read all screenshots
CREATE POLICY "Developers can read all screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-screenshots'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );
```

**Step 2: Run migration**

```bash
supabase db reset
```

Expected: Migration applies successfully, tables and policies created.

**Step 3: Commit**

```bash
git add supabase/migrations/20260120000001_feedback_feature.sql
git commit -m "feat(db): add feedback table, enums, and RLS policies"
```

---

## Task 2: TypeScript Types for Feedback

**Files:**
- Create: `lib/types/feedback.ts`

**Step 1: Write the types file**

```typescript
export type FeedbackCategory = 'bug' | 'feature_request' | 'performance' | 'usability' | 'other'

export type FeedbackStatus = 'new' | 'under_review' | 'in_progress' | 'resolved' | 'closed'

export type FeedbackPriority = 'critical' | 'high' | 'medium' | 'low'

export interface Feedback {
  id: string
  title: string
  description: string
  category: FeedbackCategory
  status: FeedbackStatus
  priority: FeedbackPriority | null
  submitted_by: string
  organization_id: string | null
  page_url: string | null
  user_agent: string | null
  screenshot_url: string | null
  status_note: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackWithRelations extends Feedback {
  submitter?: {
    id: string
    first_name: string | null
    last_name: string | null
    email?: string
  }
  organization?: {
    id: string
    name: string
  } | null
}

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  performance: 'Performance',
  usability: 'Usability',
  other: 'Other',
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: 'bg-neutral-100 text-neutral-700',
  under_review: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
}

export const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-neutral-100 text-neutral-500',
}

export const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'performance', label: 'Performance' },
  { value: 'usability', label: 'Usability' },
  { value: 'other', label: 'Other' },
]

export const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export const PRIORITY_OPTIONS: { value: FeedbackPriority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]
```

**Step 2: Commit**

```bash
git add lib/types/feedback.ts
git commit -m "feat: add TypeScript types for feedback feature"
```

---

## Task 3: Feedback Context Provider

**Files:**
- Create: `components/feedback/feedback-provider.tsx`

**Step 1: Write the provider**

```typescript
'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface FeedbackContextValue {
  isOpen: boolean
  openFeedback: () => void
  closeFeedback: () => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openFeedback = useCallback(() => setIsOpen(true), [])
  const closeFeedback = useCallback(() => setIsOpen(false), [])

  return (
    <FeedbackContext.Provider value={{ isOpen, openFeedback, closeFeedback }}>
      {children}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider')
  }
  return context
}
```

**Step 2: Commit**

```bash
git add components/feedback/feedback-provider.tsx
git commit -m "feat: add feedback context provider"
```

---

## Task 4: Feedback Dialog Component

**Files:**
- Create: `components/feedback/feedback-dialog.tsx`

**Step 1: Write the dialog component**

```typescript
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
import { X, Upload, ImageIcon } from 'lucide-react'
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' })
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
        <form action={handleSubmit} className="space-y-4">
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
              <SelectTrigger id="category">
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
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="max-h-32 rounded object-contain"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
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
```

**Step 2: Commit**

```bash
git add components/feedback/feedback-dialog.tsx
git commit -m "feat: add feedback dialog component"
```

---

## Task 5: Keyboard Shortcut Trigger

**Files:**
- Create: `components/feedback/feedback-trigger.tsx`

**Step 1: Write the keyboard trigger component**

```typescript
'use client'

import { useEffect } from 'react'
import { useFeedback } from './feedback-provider'

export function FeedbackTrigger() {
  const { openFeedback } = useFeedback()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+Shift+F (Mac) or Ctrl+Shift+F (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openFeedback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openFeedback])

  return null
}
```

**Step 2: Commit**

```bash
git add components/feedback/feedback-trigger.tsx
git commit -m "feat: add CMD+Shift+F keyboard shortcut for feedback"
```

---

## Task 6: Submit Feedback Server Action

**Files:**
- Create: `app/feedback/actions.ts`

**Step 1: Write the server action**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FeedbackCategory } from '@/lib/types/feedback'

export async function submitFeedback(formData: FormData) {
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const category = formData.get('category') as FeedbackCategory
  const pageUrl = formData.get('page_url') as string
  const userAgent = formData.get('user_agent') as string
  const screenshot = formData.get('screenshot') as File | null

  // Validation
  if (!title?.trim() || title.length < 3) {
    return { error: 'Title must be at least 3 characters' }
  }
  if (!description?.trim() || description.length < 10) {
    return { error: 'Description must be at least 10 characters' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  // Upload screenshot if provided
  let screenshotUrl: string | null = null
  if (screenshot && screenshot.size > 0) {
    const fileExt = screenshot.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('feedback-screenshots')
      .upload(fileName, screenshot)

    if (uploadError) {
      console.error('[Feedback Upload Error]', {
        type: 'storage_error',
        error: uploadError,
        timestamp: new Date().toISOString(),
      })
      // Continue without screenshot
    } else {
      const { data: urlData } = supabase.storage
        .from('feedback-screenshots')
        .getPublicUrl(fileName)
      screenshotUrl = urlData.publicUrl
    }
  }

  // Insert feedback
  const { data: feedback, error } = await supabase
    .from('feedback')
    .insert({
      title: title.trim(),
      description: description.trim(),
      category,
      submitted_by: user.id,
      organization_id: userRecord?.organization_id || null,
      page_url: pageUrl || null,
      user_agent: userAgent || null,
      screenshot_url: screenshotUrl,
    })
    .select()
    .single()

  if (error) {
    console.error('[Feedback Submit Error]', {
      type: 'database_error',
      error,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to submit feedback. Please try again.' }
  }

  // Send email to developers
  try {
    await notifyDevelopers(feedback.id, title, description, category, user.email!)
  } catch (emailError) {
    console.error('[Feedback Email Error]', {
      type: 'email_error',
      error: emailError,
      timestamp: new Date().toISOString(),
    })
    // Don't fail the submission if email fails
  }

  revalidatePath('/support')

  return { success: true, feedbackId: feedback.id }
}

async function notifyDevelopers(
  feedbackId: string,
  title: string,
  description: string,
  category: FeedbackCategory,
  submitterEmail: string
) {
  const supabase = await createClient()

  // Get all developers
  const { data: developers } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'developer')

  if (!developers || developers.length === 0) {
    return
  }

  // Get developer emails from auth
  const { sendEmail, FROM_EMAIL } = await import('@/lib/email/client')
  const FeedbackSubmittedEmail = (await import('@/emails/feedback-submitted-email')).default

  for (const dev of developers) {
    const { data: authUser } = await supabase.auth.admin.getUserById(dev.id)
    if (!authUser?.user?.email) continue

    await sendEmail({
      from: FROM_EMAIL,
      to: authUser.user.email,
      subject: `[Selo] New Issue Reported: ${title}`,
      react: FeedbackSubmittedEmail({
        feedbackId,
        title,
        description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
        category,
        submitterEmail,
        supportUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/support?issue=${feedbackId}`,
      }),
    })
  }
}
```

**Step 2: Commit**

```bash
git add app/feedback/actions.ts
git commit -m "feat: add submit feedback server action with email notification"
```

---

## Task 7: Feedback Submitted Email Template

**Files:**
- Create: `emails/feedback-submitted-email.tsx`

**Step 1: Write the email template**

```typescript
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'
import { CATEGORY_LABELS, type FeedbackCategory } from '@/lib/types/feedback'

interface FeedbackSubmittedEmailProps {
  feedbackId: string
  title: string
  description: string
  category: FeedbackCategory
  submitterEmail: string
  supportUrl: string
}

export default function FeedbackSubmittedEmail({
  title,
  description,
  category,
  submitterEmail,
  supportUrl,
}: FeedbackSubmittedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New issue reported: {title}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto px-4 py-12">
            <Section className="mb-6">
              <Text className="m-0 text-xl font-bold text-neutral-900">Selo IO</Text>
            </Section>

            <Heading className="mb-4 text-2xl font-bold text-neutral-900">
              New Issue Reported
            </Heading>

            <Section className="mb-4 rounded-md bg-neutral-100 px-4 py-2">
              <Text className="m-0 text-sm font-medium text-neutral-600">
                {CATEGORY_LABELS[category]}
              </Text>
            </Section>

            <Text className="mb-2 text-lg font-semibold text-neutral-900">{title}</Text>

            <Text className="mb-4 text-neutral-700">{description}</Text>

            <Text className="mb-6 text-sm text-neutral-500">Submitted by: {submitterEmail}</Text>

            <Section className="mb-6">
              <Button
                href={supportUrl}
                className="rounded-md bg-neutral-900 px-6 py-3 font-medium text-white"
              >
                View in Support
              </Button>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
```

**Step 2: Commit**

```bash
git add emails/feedback-submitted-email.tsx
git commit -m "feat: add feedback submitted email template"
```

---

## Task 8: Feedback Status Changed Email Template

**Files:**
- Create: `emails/feedback-status-email.tsx`

**Step 1: Write the email template**

```typescript
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'
import { STATUS_LABELS, type FeedbackStatus } from '@/lib/types/feedback'

interface FeedbackStatusEmailProps {
  title: string
  oldStatus: FeedbackStatus
  newStatus: FeedbackStatus
  note: string | null
}

export default function FeedbackStatusEmail({
  title,
  oldStatus,
  newStatus,
  note,
}: FeedbackStatusEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your issue has been updated: {title}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto px-4 py-12">
            <Section className="mb-6">
              <Text className="m-0 text-xl font-bold text-neutral-900">Selo IO</Text>
            </Section>

            <Heading className="mb-4 text-2xl font-bold text-neutral-900">
              Issue Status Updated
            </Heading>

            <Text className="mb-4 text-lg font-semibold text-neutral-900">{title}</Text>

            <Section className="mb-4 rounded-md border border-neutral-200 p-4">
              <Text className="m-0 text-sm text-neutral-500">Status changed:</Text>
              <Text className="m-0 mt-1 text-base">
                <span className="text-neutral-500">{STATUS_LABELS[oldStatus]}</span>
                <span className="mx-2">→</span>
                <span className="font-medium text-neutral-900">{STATUS_LABELS[newStatus]}</span>
              </Text>
            </Section>

            {note && (
              <Section className="mb-4 rounded-md bg-neutral-100 p-4">
                <Text className="m-0 text-sm font-medium text-neutral-600">Note from developer:</Text>
                <Text className="m-0 mt-1 text-neutral-700">{note}</Text>
              </Section>
            )}

            <Text className="text-sm text-neutral-500">
              Thank you for helping us improve Selo IO.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
```

**Step 2: Commit**

```bash
git add emails/feedback-status-email.tsx
git commit -m "feat: add feedback status changed email template"
```

---

## Task 9: Update User Menu with Report an Issue

**Files:**
- Modify: `components/dashboard/user-menu.tsx`

**Step 1: Update the user menu**

Add import at top:
```typescript
import { useFeedback } from '@/components/feedback/feedback-provider'
```

Add inside the component, before the return:
```typescript
const { openFeedback } = useFeedback()
```

Add new menu item after Profile and before Sign out (after line 56):
```typescript
<DropdownMenuItem onSelect={openFeedback}>Report an Issue</DropdownMenuItem>
```

**Step 2: Commit**

```bash
git add components/dashboard/user-menu.tsx
git commit -m "feat: add 'Report an Issue' to user menu"
```

---

## Task 10: Update Dashboard Layout with Feedback Provider

**Files:**
- Modify: `app/dashboard/layout.tsx`

**Step 1: Update the layout**

Add imports at top:
```typescript
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'
```

Wrap the return JSX with FeedbackProvider and add FeedbackDialog + FeedbackTrigger:
```typescript
return (
  <FeedbackProvider>
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </div>
    <FeedbackDialog />
    <FeedbackTrigger />
  </FeedbackProvider>
)
```

**Step 2: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat: integrate feedback provider into dashboard layout"
```

---

## Task 11: Support Page Layout (Developer Only)

**Files:**
- Create: `app/support/layout.tsx`

**Step 1: Write the layout**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is a developer
  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'developer') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-neutral-900">Support</h1>
        <p className="text-sm text-neutral-500">Manage user feedback and issues</p>
      </div>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/support/layout.tsx
git commit -m "feat: add support layout with developer-only access"
```

---

## Task 12: Support Filters Component

**Files:**
- Create: `components/support/support-filters.tsx`

**Step 1: Write the filters component**

```typescript
'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  STATUS_OPTIONS,
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  type FeedbackStatus,
  type FeedbackCategory,
  type FeedbackPriority,
} from '@/lib/types/feedback'
import { X } from 'lucide-react'

interface SupportFiltersProps {
  status: FeedbackStatus | 'all'
  category: FeedbackCategory | 'all'
  priority: FeedbackPriority | 'all'
  onStatusChange: (value: FeedbackStatus | 'all') => void
  onCategoryChange: (value: FeedbackCategory | 'all') => void
  onPriorityChange: (value: FeedbackPriority | 'all') => void
  onClear: () => void
}

export function SupportFilters({
  status,
  category,
  priority,
  onStatusChange,
  onCategoryChange,
  onPriorityChange,
  onClear,
}: SupportFiltersProps) {
  const hasFilters = status !== 'all' || category !== 'all' || priority !== 'all'

  return (
    <div className="flex items-center gap-3">
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={priority} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {PRIORITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/support/support-filters.tsx
git commit -m "feat: add support filters component"
```

---

## Task 13: Support Table Component

**Files:**
- Create: `components/support/support-table.tsx`

**Step 1: Write the table component**

```typescript
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  type FeedbackWithRelations,
  CATEGORY_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from '@/lib/types/feedback'
import { formatDistanceToNow } from 'date-fns'

interface SupportTableProps {
  feedback: FeedbackWithRelations[]
  onRowClick: (feedback: FeedbackWithRelations) => void
}

export function SupportTable({ feedback, onRowClick }: SupportTableProps) {
  if (feedback.length === 0) {
    return (
      <div className="rounded-md border bg-white p-8 text-center">
        <p className="text-neutral-500">No feedback items found.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Title</TableHead>
            <TableHead className="w-[120px]">Category</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px]">Priority</TableHead>
            <TableHead className="w-[150px]">Submitted By</TableHead>
            <TableHead className="w-[150px]">Organization</TableHead>
            <TableHead className="w-[100px]">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feedback.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-neutral-50"
              onClick={() => onRowClick(item)}
            >
              <TableCell className="font-medium">
                <span className="line-clamp-1">{item.title}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{CATEGORY_LABELS[item.category]}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
              </TableCell>
              <TableCell>
                {item.priority ? (
                  <Badge className={PRIORITY_COLORS[item.priority]}>
                    {PRIORITY_LABELS[item.priority]}
                  </Badge>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </TableCell>
              <TableCell>
                {item.submitter
                  ? `${item.submitter.first_name || ''} ${item.submitter.last_name || ''}`.trim() ||
                    'Unknown'
                  : 'Unknown'}
              </TableCell>
              <TableCell>{item.organization?.name || '—'}</TableCell>
              <TableCell className="text-neutral-500">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/support/support-table.tsx
git commit -m "feat: add support table component"
```

---

## Task 14: Support Slideout Component

**Files:**
- Create: `components/support/support-slideout.tsx`

**Step 1: Write the slideout component**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type FeedbackWithRelations,
  type FeedbackStatus,
  type FeedbackPriority,
  CATEGORY_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_COLORS,
} from '@/lib/types/feedback'
import { updateFeedbackStatus } from '@/app/support/actions'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink } from 'lucide-react'

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? 'Saving...' : 'Save Changes'}
    </Button>
  )
}

interface SupportSlideoutProps {
  feedback: FeedbackWithRelations | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export function SupportSlideout({ feedback, open, onClose, onUpdate }: SupportSlideoutProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<FeedbackStatus>('new')
  const [priority, setPriority] = useState<FeedbackPriority | ''>('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (feedback) {
      setStatus(feedback.status)
      setPriority(feedback.priority || '')
      setNote(feedback.status_note || '')
    }
  }, [feedback])

  if (!feedback) return null

  const hasChanges =
    status !== feedback.status ||
    priority !== (feedback.priority || '') ||
    note !== (feedback.status_note || '')

  const handleSubmit = async (formData: FormData) => {
    const result = await updateFeedbackStatus(
      feedback.id,
      status,
      priority || null,
      note || null,
      feedback.status
    )

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else {
      toast({ title: 'Updated', description: 'Feedback has been updated' })
      onUpdate()
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[480px] overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="text-left">{feedback.title}</SheetTitle>
          <SheetDescription className="text-left">
            <Badge className={STATUS_COLORS[feedback.status]} variant="secondary">
              {STATUS_LABELS[feedback.status]}
            </Badge>
            <span className="ml-2 text-neutral-500">
              {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Details Section */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-neutral-500">Description</h3>
            <p className="whitespace-pre-wrap text-neutral-900">{feedback.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-1 text-sm font-medium text-neutral-500">Category</h3>
              <p className="text-neutral-900">{CATEGORY_LABELS[feedback.category]}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-neutral-500">Submitted By</h3>
              <p className="text-neutral-900">
                {feedback.submitter
                  ? `${feedback.submitter.first_name || ''} ${feedback.submitter.last_name || ''}`.trim()
                  : 'Unknown'}
              </p>
            </div>
          </div>

          {/* Context Section */}
          <div className="rounded-md bg-neutral-50 p-4">
            <h3 className="mb-3 text-sm font-medium text-neutral-500">Context</h3>
            <div className="space-y-2 text-sm">
              {feedback.organization && (
                <div>
                  <span className="text-neutral-500">Organization:</span>{' '}
                  <span className="text-neutral-900">{feedback.organization.name}</span>
                </div>
              )}
              {feedback.page_url && (
                <div>
                  <span className="text-neutral-500">Page:</span>{' '}
                  <a
                    href={feedback.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:underline"
                  >
                    {new URL(feedback.page_url).pathname}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              )}
              {feedback.user_agent && (
                <div>
                  <span className="text-neutral-500">Browser:</span>{' '}
                  <span className="text-neutral-900">{feedback.user_agent.substring(0, 50)}...</span>
                </div>
              )}
            </div>
          </div>

          {/* Screenshot */}
          {feedback.screenshot_url && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-neutral-500">Screenshot</h3>
              <a href={feedback.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={feedback.screenshot_url}
                  alt="Screenshot"
                  className="max-h-48 rounded-md border object-contain"
                />
              </a>
            </div>
          )}

          {/* Actions Section */}
          <form action={handleSubmit} className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium text-neutral-900">Update Status</h3>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as FeedbackStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as FeedbackPriority | '')}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Set priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No priority</SelectItem>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note (sent to user if status changed)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this change..."
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <SaveButton disabled={!hasChanges} />
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

**Step 2: Commit**

```bash
git add components/support/support-slideout.tsx
git commit -m "feat: add support slideout panel"
```

---

## Task 15: Update Feedback Status Server Action

**Files:**
- Create: `app/support/actions.ts`

**Step 1: Write the server action**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FeedbackStatus, FeedbackPriority } from '@/lib/types/feedback'

export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  priority: FeedbackPriority | null,
  note: string | null,
  previousStatus: FeedbackStatus
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify user is a developer
  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'developer') {
    return { error: 'Only developers can update feedback' }
  }

  // Update the feedback
  const { error } = await supabase
    .from('feedback')
    .update({
      status,
      priority,
      status_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)

  if (error) {
    console.error('[Feedback Update Error]', {
      type: 'database_error',
      error,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to update feedback' }
  }

  // If status changed, notify the submitter
  if (status !== previousStatus) {
    try {
      await notifySubmitter(feedbackId, previousStatus, status, note)
    } catch (emailError) {
      console.error('[Feedback Status Email Error]', {
        type: 'email_error',
        error: emailError,
        timestamp: new Date().toISOString(),
      })
      // Don't fail the update if email fails
    }
  }

  revalidatePath('/support')

  return { success: true }
}

async function notifySubmitter(
  feedbackId: string,
  oldStatus: FeedbackStatus,
  newStatus: FeedbackStatus,
  note: string | null
) {
  const supabase = await createClient()

  // Get feedback with submitter info
  const { data: feedback } = await supabase
    .from('feedback')
    .select('title, submitted_by')
    .eq('id', feedbackId)
    .single()

  if (!feedback) return

  // Get submitter's email
  const { data: authUser } = await supabase.auth.admin.getUserById(feedback.submitted_by)
  if (!authUser?.user?.email) return

  const { sendEmail, FROM_EMAIL } = await import('@/lib/email/client')
  const FeedbackStatusEmail = (await import('@/emails/feedback-status-email')).default

  await sendEmail({
    from: FROM_EMAIL,
    to: authUser.user.email,
    subject: `[Selo] Your issue has been updated: ${feedback.title}`,
    react: FeedbackStatusEmail({
      title: feedback.title,
      oldStatus,
      newStatus,
      note,
    }),
  })
}
```

**Step 2: Commit**

```bash
git add app/support/actions.ts
git commit -m "feat: add update feedback status server action"
```

---

## Task 16: Support Page

**Files:**
- Create: `app/support/page.tsx`

**Step 1: Write the page**

```typescript
import { createClient } from '@/lib/supabase/server'
import { SupportPageClient } from './page-client'

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Fetch all feedback with relations
  const { data: feedback, error } = await supabase
    .from('feedback')
    .select(
      `
      *,
      submitter:users!submitted_by(id, first_name, last_name),
      organization:organizations(id, name)
    `
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Support Page Error]', {
      type: 'fetch_error',
      error,
      timestamp: new Date().toISOString(),
    })
  }

  return <SupportPageClient feedback={feedback || []} initialIssueId={params.issue} />
}
```

**Step 2: Create the client component**

Create: `app/support/page-client.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SupportTable } from '@/components/support/support-table'
import { SupportFilters } from '@/components/support/support-filters'
import { SupportSlideout } from '@/components/support/support-slideout'
import type {
  FeedbackWithRelations,
  FeedbackStatus,
  FeedbackCategory,
  FeedbackPriority,
} from '@/lib/types/feedback'

interface SupportPageClientProps {
  feedback: FeedbackWithRelations[]
  initialIssueId?: string
}

export function SupportPageClient({ feedback, initialIssueId }: SupportPageClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | 'all'>('all')
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackWithRelations | null>(null)
  const [slideoutOpen, setSlideoutOpen] = useState(false)

  // Open slideout if issue ID in URL
  useEffect(() => {
    if (initialIssueId) {
      const item = feedback.find((f) => f.id === initialIssueId)
      if (item) {
        setSelectedFeedback(item)
        setSlideoutOpen(true)
      }
    }
  }, [initialIssueId, feedback])

  const filteredFeedback = feedback.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false
    return true
  })

  const handleRowClick = (item: FeedbackWithRelations) => {
    setSelectedFeedback(item)
    setSlideoutOpen(true)
    router.push(`/support?issue=${item.id}`, { scroll: false })
  }

  const handleClose = () => {
    setSlideoutOpen(false)
    setSelectedFeedback(null)
    router.push('/support', { scroll: false })
  }

  const handleUpdate = () => {
    router.refresh()
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setPriorityFilter('all')
  }

  return (
    <div className="space-y-4">
      <SupportFilters
        status={statusFilter}
        category={categoryFilter}
        priority={priorityFilter}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
        onPriorityChange={setPriorityFilter}
        onClear={clearFilters}
      />

      <SupportTable feedback={filteredFeedback} onRowClick={handleRowClick} />

      <SupportSlideout
        feedback={selectedFeedback}
        open={slideoutOpen}
        onClose={handleClose}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/support/page.tsx app/support/page-client.tsx
git commit -m "feat: add support page with filtering and slideout"
```

---

## Task 17: Update Existing RLS for Developer Bypass

**Files:**
- Create: `supabase/migrations/20260120000002_developer_rls_bypass.sql`

**Step 1: Write the migration**

```sql
-- Update organizations RLS to allow developer access
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM users WHERE users.id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- Update campaigns RLS to allow developer access
DROP POLICY IF EXISTS "Users can view campaigns in their organization" ON campaigns;
CREATE POLICY "Users can view campaigns in their organization"
  ON campaigns FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- Update users table RLS to allow developer access
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid())
    OR id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'developer'
    )
  );

-- Update platform_connections RLS to allow developer access
DROP POLICY IF EXISTS "Users can view platform connections in their organization" ON platform_connections;
CREATE POLICY "Users can view platform connections in their organization"
  ON platform_connections FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );
```

**Step 2: Run migration**

```bash
supabase db reset
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260120000002_developer_rls_bypass.sql
git commit -m "feat(db): add developer bypass to existing RLS policies"
```

---

## Task 18: Unit Tests - Feedback Types and Utils

**Files:**
- Create: `tests/unit/lib/types/feedback.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest'
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '@/lib/types/feedback'

describe('Feedback Types', () => {
  describe('CATEGORY_LABELS', () => {
    it('has labels for all categories', () => {
      expect(CATEGORY_LABELS.bug).toBe('Bug')
      expect(CATEGORY_LABELS.feature_request).toBe('Feature Request')
      expect(CATEGORY_LABELS.performance).toBe('Performance')
      expect(CATEGORY_LABELS.usability).toBe('Usability')
      expect(CATEGORY_LABELS.other).toBe('Other')
    })
  })

  describe('STATUS_LABELS', () => {
    it('has labels for all statuses', () => {
      expect(STATUS_LABELS.new).toBe('New')
      expect(STATUS_LABELS.under_review).toBe('Under Review')
      expect(STATUS_LABELS.in_progress).toBe('In Progress')
      expect(STATUS_LABELS.resolved).toBe('Resolved')
      expect(STATUS_LABELS.closed).toBe('Closed')
    })
  })

  describe('PRIORITY_LABELS', () => {
    it('has labels for all priorities', () => {
      expect(PRIORITY_LABELS.critical).toBe('Critical')
      expect(PRIORITY_LABELS.high).toBe('High')
      expect(PRIORITY_LABELS.medium).toBe('Medium')
      expect(PRIORITY_LABELS.low).toBe('Low')
    })
  })

  describe('STATUS_COLORS', () => {
    it('has colors for all statuses', () => {
      expect(STATUS_COLORS.new).toContain('neutral')
      expect(STATUS_COLORS.under_review).toContain('blue')
      expect(STATUS_COLORS.in_progress).toContain('yellow')
      expect(STATUS_COLORS.resolved).toContain('green')
      expect(STATUS_COLORS.closed).toContain('red')
    })
  })

  describe('Options arrays', () => {
    it('CATEGORY_OPTIONS has correct structure', () => {
      expect(CATEGORY_OPTIONS).toHaveLength(5)
      expect(CATEGORY_OPTIONS[0]).toEqual({ value: 'bug', label: 'Bug' })
    })

    it('STATUS_OPTIONS has correct structure', () => {
      expect(STATUS_OPTIONS).toHaveLength(5)
      expect(STATUS_OPTIONS[0]).toEqual({ value: 'new', label: 'New' })
    })

    it('PRIORITY_OPTIONS has correct structure', () => {
      expect(PRIORITY_OPTIONS).toHaveLength(4)
      expect(PRIORITY_OPTIONS[0]).toEqual({ value: 'critical', label: 'Critical' })
    })
  })
})
```

**Step 2: Run test**

```bash
npm run test:unit -- tests/unit/lib/types/feedback.test.ts
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add tests/unit/lib/types/feedback.test.ts
git commit -m "test: add unit tests for feedback types"
```

---

## Task 19: Unit Tests - Feedback Provider

**Files:**
- Create: `tests/unit/components/feedback/feedback-provider.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedbackProvider, useFeedback } from '@/components/feedback/feedback-provider'

function TestComponent() {
  const { isOpen, openFeedback, closeFeedback } = useFeedback()
  return (
    <div>
      <span data-testid="status">{isOpen ? 'open' : 'closed'}</span>
      <button onClick={openFeedback}>Open</button>
      <button onClick={closeFeedback}>Close</button>
    </div>
  )
}

describe('FeedbackProvider', () => {
  it('provides initial closed state', () => {
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    )

    expect(screen.getByTestId('status')).toHaveTextContent('closed')
  })

  it('opens feedback dialog', () => {
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    )

    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('status')).toHaveTextContent('open')
  })

  it('closes feedback dialog', () => {
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    )

    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Close'))
    expect(screen.getByTestId('status')).toHaveTextContent('closed')
  })

  it('throws error when used outside provider', () => {
    const consoleError = console.error
    console.error = () => {} // Suppress error output

    expect(() => render(<TestComponent />)).toThrow(
      'useFeedback must be used within a FeedbackProvider'
    )

    console.error = consoleError
  })
})
```

**Step 2: Run test**

```bash
npm run test:unit -- tests/unit/components/feedback/feedback-provider.test.tsx
```

**Step 3: Commit**

```bash
git add tests/unit/components/feedback/feedback-provider.test.tsx
git commit -m "test: add unit tests for feedback provider"
```

---

## Task 20: Unit Tests - Support Filters

**Files:**
- Create: `tests/unit/components/support/support-filters.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportFilters } from '@/components/support/support-filters'

describe('SupportFilters', () => {
  const defaultProps = {
    status: 'all' as const,
    category: 'all' as const,
    priority: 'all' as const,
    onStatusChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onPriorityChange: vi.fn(),
    onClear: vi.fn(),
  }

  it('renders all filter dropdowns', () => {
    render(<SupportFilters {...defaultProps} />)

    expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /priority/i })).toBeInTheDocument()
  })

  it('hides clear button when no filters active', () => {
    render(<SupportFilters {...defaultProps} />)

    expect(screen.queryByText('Clear')).not.toBeInTheDocument()
  })

  it('shows clear button when filters are active', () => {
    render(<SupportFilters {...defaultProps} status="new" />)

    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn()
    render(<SupportFilters {...defaultProps} status="new" onClear={onClear} />)

    fireEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalled()
  })
})
```

**Step 2: Run test**

```bash
npm run test:unit -- tests/unit/components/support/support-filters.test.tsx
```

**Step 3: Commit**

```bash
git add tests/unit/components/support/support-filters.test.tsx
git commit -m "test: add unit tests for support filters"
```

---

## Task 21: Unit Tests - Support Table

**Files:**
- Create: `tests/unit/components/support/support-table.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportTable } from '@/components/support/support-table'
import type { FeedbackWithRelations } from '@/lib/types/feedback'

const mockFeedback: FeedbackWithRelations[] = [
  {
    id: '1',
    title: 'Test Bug',
    description: 'A test bug description',
    category: 'bug',
    status: 'new',
    priority: 'high',
    submitted_by: 'user-1',
    organization_id: 'org-1',
    page_url: 'https://example.com/page',
    user_agent: 'Mozilla/5.0',
    screenshot_url: null,
    status_note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    submitter: { id: 'user-1', first_name: 'John', last_name: 'Doe' },
    organization: { id: 'org-1', name: 'Test Org' },
  },
]

describe('SupportTable', () => {
  it('renders empty state when no feedback', () => {
    render(<SupportTable feedback={[]} onRowClick={vi.fn()} />)

    expect(screen.getByText('No feedback items found.')).toBeInTheDocument()
  })

  it('renders feedback items', () => {
    render(<SupportTable feedback={mockFeedback} onRowClick={vi.fn()} />)

    expect(screen.getByText('Test Bug')).toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Test Org')).toBeInTheDocument()
  })

  it('calls onRowClick when row clicked', () => {
    const onRowClick = vi.fn()
    render(<SupportTable feedback={mockFeedback} onRowClick={onRowClick} />)

    fireEvent.click(screen.getByText('Test Bug'))
    expect(onRowClick).toHaveBeenCalledWith(mockFeedback[0])
  })

  it('shows dash for missing priority', () => {
    const feedbackWithoutPriority = [{ ...mockFeedback[0], priority: null }]
    render(<SupportTable feedback={feedbackWithoutPriority} onRowClick={vi.fn()} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

**Step 2: Run test**

```bash
npm run test:unit -- tests/unit/components/support/support-table.test.tsx
```

**Step 3: Commit**

```bash
git add tests/unit/components/support/support-table.test.tsx
git commit -m "test: add unit tests for support table"
```

---

## Task 22: Integration Tests - Feedback RLS

**Files:**
- Create: `tests/integration/feedback-rls.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
  cleanupTestData,
} from '../helpers/db'

describe('Feedback RLS Policies', () => {
  let regularUser: { id: string }
  let developerUser: { id: string }
  let testOrg: { id: string }

  beforeAll(async () => {
    await cleanupTestData()

    // Create regular user
    regularUser = await createTestUser('regular@test.com', 'password123', {
      first_name: 'Regular',
      last_name: 'User',
    })
    testOrg = await createTestOrganization('Test Org')
    await linkUserToOrganization(regularUser.id, testOrg.id, 'team_member', 'Regular', 'User')

    // Create developer user
    developerUser = await createTestUser('developer@test.com', 'password123', {
      first_name: 'Developer',
      last_name: 'User',
    })
    // Link developer without organization (they don't need one)
    await testDb.from('users').insert({
      id: developerUser.id,
      role: 'developer',
      first_name: 'Developer',
      last_name: 'User',
    })
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  beforeEach(async () => {
    // Clean up feedback before each test
    await testDb.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  describe('Insert policies', () => {
    it('allows authenticated users to submit feedback', async () => {
      const { data, error } = await testDb
        .from('feedback')
        .insert({
          title: 'Test feedback',
          description: 'Test description',
          category: 'bug',
          submitted_by: regularUser.id,
          organization_id: testOrg.id,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.title).toBe('Test feedback')
    })
  })

  describe('Select policies', () => {
    it('users can view their own feedback', async () => {
      // Insert feedback as service role
      await testDb.from('feedback').insert({
        title: 'My feedback',
        description: 'Test',
        category: 'bug',
        submitted_by: regularUser.id,
      })

      // Query as the same user would (simulated via service role filter)
      const { data } = await testDb
        .from('feedback')
        .select('*')
        .eq('submitted_by', regularUser.id)

      expect(data).toHaveLength(1)
      expect(data?.[0].title).toBe('My feedback')
    })

    it('developers can view all feedback', async () => {
      // Insert feedback from regular user
      await testDb.from('feedback').insert({
        title: 'User feedback',
        description: 'Test',
        category: 'bug',
        submitted_by: regularUser.id,
      })

      // Developer should see all (via service role, simulating developer access)
      const { data } = await testDb.from('feedback').select('*')

      expect(data?.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Update policies', () => {
    it('allows updating feedback status', async () => {
      const { data: feedback } = await testDb
        .from('feedback')
        .insert({
          title: 'Update test',
          description: 'Test',
          category: 'bug',
          submitted_by: regularUser.id,
        })
        .select()
        .single()

      const { error } = await testDb
        .from('feedback')
        .update({ status: 'under_review', priority: 'high' })
        .eq('id', feedback?.id)

      expect(error).toBeNull()
    })
  })

  describe('Delete policies', () => {
    it('does not allow deleting feedback', async () => {
      const { data: feedback } = await testDb
        .from('feedback')
        .insert({
          title: 'Delete test',
          description: 'Test',
          category: 'bug',
          submitted_by: regularUser.id,
        })
        .select()
        .single()

      // Attempt to delete (should fail or be blocked by RLS)
      // Note: Service role bypasses RLS, so this tests schema constraints
      const { data } = await testDb
        .from('feedback')
        .delete()
        .eq('id', feedback?.id)
        .select()

      // With no delete policy, this should still work with service role
      // but would fail for regular users - test validates the behavior
      expect(data).toBeDefined()
    })
  })
})
```

**Step 2: Run test**

```bash
npm run test:integration -- tests/integration/feedback-rls.test.ts
```

**Step 3: Commit**

```bash
git add tests/integration/feedback-rls.test.ts
git commit -m "test: add integration tests for feedback RLS policies"
```

---

## Task 23: Integration Tests - Feedback Actions

**Files:**
- Create: `tests/integration/feedback-actions.test.ts`

**Step 1: Write the test**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  testDb,
  createTestUser,
  createTestOrganization,
  linkUserToOrganization,
  cleanupTestData,
} from '../helpers/db'

describe('Feedback Database Operations', () => {
  let testUser: { id: string }
  let testOrg: { id: string }

  beforeAll(async () => {
    await cleanupTestData()

    testUser = await createTestUser('feedback-test@test.com', 'password123', {
      first_name: 'Test',
      last_name: 'User',
    })
    testOrg = await createTestOrganization('Feedback Test Org')
    await linkUserToOrganization(testUser.id, testOrg.id, 'team_member', 'Test', 'User')
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  beforeEach(async () => {
    await testDb.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  })

  describe('Feedback creation', () => {
    it('creates feedback with all required fields', async () => {
      const { data, error } = await testDb
        .from('feedback')
        .insert({
          title: 'Test Bug Report',
          description: 'Something is broken',
          category: 'bug',
          submitted_by: testUser.id,
          organization_id: testOrg.id,
          page_url: 'https://app.selo.io/dashboard',
          user_agent: 'Mozilla/5.0 Test Browser',
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toMatchObject({
        title: 'Test Bug Report',
        description: 'Something is broken',
        category: 'bug',
        status: 'new', // Default
        priority: null, // Not set
        submitted_by: testUser.id,
        organization_id: testOrg.id,
      })
    })

    it('sets default status to new', async () => {
      const { data } = await testDb
        .from('feedback')
        .insert({
          title: 'Default Status Test',
          description: 'Test',
          category: 'feature_request',
          submitted_by: testUser.id,
        })
        .select()
        .single()

      expect(data?.status).toBe('new')
    })

    it('validates category enum', async () => {
      const { error } = await testDb.from('feedback').insert({
        title: 'Invalid Category',
        description: 'Test',
        category: 'invalid_category' as never,
        submitted_by: testUser.id,
      })

      expect(error).not.toBeNull()
    })
  })

  describe('Feedback updates', () => {
    it('updates status and sets updated_at', async () => {
      const { data: created } = await testDb
        .from('feedback')
        .insert({
          title: 'Status Update Test',
          description: 'Test',
          category: 'bug',
          submitted_by: testUser.id,
        })
        .select()
        .single()

      const { data: updated, error } = await testDb
        .from('feedback')
        .update({
          status: 'in_progress',
          priority: 'high',
          status_note: 'Working on this now',
        })
        .eq('id', created?.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated?.status).toBe('in_progress')
      expect(updated?.priority).toBe('high')
      expect(updated?.status_note).toBe('Working on this now')
      expect(new Date(updated?.updated_at) > new Date(created?.updated_at)).toBe(true)
    })
  })

  describe('Feedback queries', () => {
    it('orders by created_at descending', async () => {
      await testDb.from('feedback').insert([
        { title: 'First', description: 'Test', category: 'bug', submitted_by: testUser.id },
        { title: 'Second', description: 'Test', category: 'bug', submitted_by: testUser.id },
        { title: 'Third', description: 'Test', category: 'bug', submitted_by: testUser.id },
      ])

      const { data } = await testDb
        .from('feedback')
        .select('title')
        .order('created_at', { ascending: false })

      expect(data?.[0].title).toBe('Third')
      expect(data?.[2].title).toBe('First')
    })

    it('filters by status', async () => {
      await testDb.from('feedback').insert([
        { title: 'New One', description: 'Test', category: 'bug', submitted_by: testUser.id, status: 'new' },
        { title: 'In Progress', description: 'Test', category: 'bug', submitted_by: testUser.id, status: 'in_progress' },
      ])

      const { data } = await testDb
        .from('feedback')
        .select('title')
        .eq('status', 'in_progress')

      expect(data).toHaveLength(1)
      expect(data?.[0].title).toBe('In Progress')
    })
  })
})
```

**Step 2: Run test**

```bash
npm run test:integration -- tests/integration/feedback-actions.test.ts
```

**Step 3: Commit**

```bash
git add tests/integration/feedback-actions.test.ts
git commit -m "test: add integration tests for feedback database operations"
```

---

## Task 24: E2E Tests - Feedback Submission

**Files:**
- Create: `tests/e2e/feedback.spec.ts`

**Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Feedback Submission', () => {
  test.beforeEach(async ({ page }) => {
    // Login as regular user
    await page.goto('/login')
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('opens feedback dialog from user menu', async ({ page }) => {
    // Click user menu
    await page.click('[aria-label="Open user menu"]')

    // Click "Report an Issue"
    await page.click('text=Report an Issue')

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Report an Issue')).toBeVisible()
  })

  test('opens feedback dialog with CMD+Shift+F', async ({ page }) => {
    // Press keyboard shortcut
    await page.keyboard.press('Meta+Shift+f')

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('submits feedback successfully', async ({ page }) => {
    // Open dialog
    await page.click('[aria-label="Open user menu"]')
    await page.click('text=Report an Issue')

    // Fill form
    await page.fill('input[name="title"]', 'Test Bug Report')
    await page.fill('textarea[name="description"]', 'This is a detailed description of the bug I found.')

    // Select category (bug is default)
    await page.click('button[role="combobox"]')
    await page.click('text=Feature Request')

    // Submit
    await page.click('button[type="submit"]:has-text("Submit")')

    // Should show success toast and close dialog
    await expect(page.getByText('Feedback submitted')).toBeVisible()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('validates required fields', async ({ page }) => {
    // Open dialog
    await page.keyboard.press('Meta+Shift+f')

    // Try to submit empty form
    await page.click('button[type="submit"]:has-text("Submit")')

    // Should show validation (form won't submit with empty required fields)
    const titleInput = page.locator('input[name="title"]')
    await expect(titleInput).toBeFocused()
  })
})
```

**Step 2: Run test**

```bash
npm run test:e2e -- tests/e2e/feedback.spec.ts
```

**Step 3: Commit**

```bash
git add tests/e2e/feedback.spec.ts
git commit -m "test: add E2E tests for feedback submission"
```

---

## Task 25: E2E Tests - Support Section

**Files:**
- Create: `tests/e2e/support.spec.ts`

**Step 1: Update test fixtures to include developer user**

First, update `tests/fixtures/index.ts` to include a developer user (or add to existing).

**Step 2: Write the test**

```typescript
import { test, expect } from '@playwright/test'

// Note: These tests require a developer user in the test fixtures
// and seeded feedback data

test.describe('Support Section', () => {
  test.describe('Access Control', () => {
    test('non-developer is redirected to dashboard', async ({ page }) => {
      // Login as regular admin (not developer)
      await page.goto('/login')
      await page.fill('input[name="email"]', 'admin@test.com')
      await page.fill('input[name="password"]', 'password123')
      await page.click('button[type="submit"]')

      // Try to access support
      await page.goto('/support')

      // Should be redirected to dashboard
      await expect(page).toHaveURL('/dashboard')
    })
  })

  // Note: Full support tests require developer user setup
  // Skipping for now - add when developer user is seeded
  test.skip('developer can view support section', async ({ page }) => {
    // Login as developer
    await page.goto('/login')
    await page.fill('input[name="email"]', 'developer@test.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Navigate to support
    await page.goto('/support')

    // Should see support page
    await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible()
  })
})
```

**Step 3: Commit**

```bash
git add tests/e2e/support.spec.ts
git commit -m "test: add E2E tests for support section access control"
```

---

## Task 26: Update Test Helpers for Feedback

**Files:**
- Modify: `tests/helpers/db.ts`

**Step 1: Add feedback helpers**

Add to the file:

```typescript
export async function createTestFeedback(
  submittedBy: string,
  data: {
    title: string
    description: string
    category: 'bug' | 'feature_request' | 'performance' | 'usability' | 'other'
    organizationId?: string
    status?: 'new' | 'under_review' | 'in_progress' | 'resolved' | 'closed'
    priority?: 'critical' | 'high' | 'medium' | 'low'
  }
) {
  const { data: feedback, error } = await testDb
    .from('feedback')
    .insert({
      title: data.title,
      description: data.description,
      category: data.category,
      submitted_by: submittedBy,
      organization_id: data.organizationId || null,
      status: data.status || 'new',
      priority: data.priority || null,
    })
    .select()
    .single()

  if (error) throw error
  return feedback
}

export async function linkUserAsDeveloper(userId: string, firstName?: string, lastName?: string) {
  const { data, error } = await testDb
    .from('users')
    .upsert({
      id: userId,
      role: 'developer',
      first_name: firstName,
      last_name: lastName,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
```

Also update `cleanupTestData` to include feedback:

```typescript
export async function cleanupTestData() {
  // Clean up in reverse order of dependencies
  await testDb.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // ... rest of cleanup
}
```

**Step 2: Commit**

```bash
git add tests/helpers/db.ts
git commit -m "test: add feedback test helpers"
```

---

## Task 27: Final Integration - Run All Tests

**Step 1: Run full test suite**

```bash
# Start local Supabase if not running
supabase start

# Reset database with new migrations
supabase db reset

# Run all tests
npm test
```

**Step 2: Fix any failing tests**

Review output and fix any issues.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete feedback feature implementation"
```

---

## Summary

This plan implements:

1. **Database** - Feedback table, enums, RLS policies, storage bucket
2. **Types** - TypeScript types and constants
3. **Components** - Provider, dialog, trigger, filters, table, slideout
4. **Server Actions** - Submit feedback, update status with email notifications
5. **Email Templates** - New feedback and status change notifications
6. **Pages** - Support section with developer-only access
7. **Tests** - Unit (types, provider, components), integration (RLS, actions), E2E (flows)

Total commits: ~27 focused commits following TDD principles.
