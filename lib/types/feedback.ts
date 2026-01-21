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

export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  bug: 'bg-red-100 text-red-700',
  feature_request: 'bg-yellow-100 text-yellow-700',
  performance: 'bg-orange-100 text-orange-700',
  usability: 'bg-blue-100 text-blue-700',
  other: 'bg-neutral-100 text-neutral-700',
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
