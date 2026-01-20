export type PerformanceAuditStatus = 'pending' | 'running' | 'completed' | 'failed'

export type CWVRating = 'good' | 'needs_improvement' | 'poor'

export type DeviceType = 'mobile' | 'desktop'

export interface PerformanceAudit {
  id: string
  organization_id: string
  created_by: string | null
  status: PerformanceAuditStatus
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  // Progress tracking
  current_url: string | null
  current_device: DeviceType | null
  total_urls: number
  completed_count: number
}

export interface PerformanceAuditResult {
  id: string
  audit_id: string
  url: string
  device: DeviceType
  // Core Web Vitals
  lcp_ms: number | null
  lcp_rating: CWVRating | null
  inp_ms: number | null
  inp_rating: CWVRating | null
  cls_score: number | null
  cls_rating: CWVRating | null
  // Lighthouse scores
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  seo_score: number | null
  // Raw response
  raw_response: Record<string, unknown> | null
  created_at: string
}

export interface MonitoredPage {
  id: string
  organization_id: string
  url: string
  added_by: string | null
  created_at: string
}

export interface MonitoredSite {
  id: string
  organization_id: string
  url: string
  run_site_audit: boolean
  run_performance_audit: boolean
  last_site_audit_at: string | null
  last_performance_audit_at: string | null
  created_at: string
}

// PageSpeed Insights API types
export interface PageSpeedResult {
  lighthouseResult: {
    categories: {
      performance?: { score: number }
      accessibility?: { score: number }
      'best-practices'?: { score: number }
      seo?: { score: number }
    }
    audits: Record<string, unknown>
  }
  loadingExperience?: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS?: {
        percentile: number
        category: string
      }
      INTERACTION_TO_NEXT_PAINT?: {
        percentile: number
        category: string
      }
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: {
        percentile: number
        category: string
      }
    }
  }
}

export interface Opportunity {
  id: string
  title: string
  description: string
  score: number
  numericValue: number
  displayValue: string
  details?: {
    items?: Array<{
      url?: string
      totalBytes?: number
      wastedBytes?: number
      wastedMs?: number
    }>
  }
}

export interface Diagnostic {
  id: string
  title: string
  description: string
  displayValue: string
  details?: {
    items?: Array<Record<string, unknown>>
  }
}
