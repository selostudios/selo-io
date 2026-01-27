import { FeedbackCategory, FeedbackStatus, FeedbackPriority } from '@/lib/enums'

export { FeedbackCategory, FeedbackStatus, FeedbackPriority }

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
  [FeedbackCategory.Bug]: 'Bug',
  [FeedbackCategory.FeatureRequest]: 'Feature Request',
  [FeedbackCategory.Performance]: 'Performance',
  [FeedbackCategory.Usability]: 'Usability',
  [FeedbackCategory.Other]: 'Other',
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  [FeedbackStatus.New]: 'New',
  [FeedbackStatus.UnderReview]: 'Under Review',
  [FeedbackStatus.InProgress]: 'In Progress',
  [FeedbackStatus.Resolved]: 'Resolved',
  [FeedbackStatus.Closed]: 'Closed',
}

export const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  [FeedbackPriority.Critical]: 'Critical',
  [FeedbackPriority.High]: 'High',
  [FeedbackPriority.Medium]: 'Medium',
  [FeedbackPriority.Low]: 'Low',
}

export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  [FeedbackStatus.New]: 'bg-neutral-100 text-neutral-700',
  [FeedbackStatus.UnderReview]: 'bg-blue-100 text-blue-700',
  [FeedbackStatus.InProgress]: 'bg-yellow-100 text-yellow-700',
  [FeedbackStatus.Resolved]: 'bg-green-100 text-green-700',
  [FeedbackStatus.Closed]: 'bg-red-100 text-red-700',
}

export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  [FeedbackCategory.Bug]: 'bg-red-100 text-red-700',
  [FeedbackCategory.FeatureRequest]: 'bg-yellow-100 text-yellow-700',
  [FeedbackCategory.Performance]: 'bg-orange-100 text-orange-700',
  [FeedbackCategory.Usability]: 'bg-blue-100 text-blue-700',
  [FeedbackCategory.Other]: 'bg-neutral-100 text-neutral-700',
}

export const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  [FeedbackPriority.Critical]: 'bg-red-100 text-red-700',
  [FeedbackPriority.High]: 'bg-orange-100 text-orange-700',
  [FeedbackPriority.Medium]: 'bg-yellow-100 text-yellow-700',
  [FeedbackPriority.Low]: 'bg-neutral-100 text-neutral-500',
}

export const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: FeedbackCategory.Bug, label: 'Bug' },
  { value: FeedbackCategory.FeatureRequest, label: 'Feature Request' },
  { value: FeedbackCategory.Performance, label: 'Performance' },
  { value: FeedbackCategory.Usability, label: 'Usability' },
  { value: FeedbackCategory.Other, label: 'Other' },
]

export const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: FeedbackStatus.New, label: 'New' },
  { value: FeedbackStatus.UnderReview, label: 'Under Review' },
  { value: FeedbackStatus.InProgress, label: 'In Progress' },
  { value: FeedbackStatus.Resolved, label: 'Resolved' },
  { value: FeedbackStatus.Closed, label: 'Closed' },
]

export const PRIORITY_OPTIONS: { value: FeedbackPriority; label: string }[] = [
  { value: FeedbackPriority.Critical, label: 'Critical' },
  { value: FeedbackPriority.High, label: 'High' },
  { value: FeedbackPriority.Medium, label: 'Medium' },
  { value: FeedbackPriority.Low, label: 'Low' },
]
