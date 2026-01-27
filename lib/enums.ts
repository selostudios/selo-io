/**
 * Centralized TypeScript enums for type-safe string comparisons.
 *
 * These enums replace string literal union types throughout the codebase.
 * String enums serialize to their values in JSON, maintaining database compatibility.
 */

// =============================================================================
// Audit Enums
// =============================================================================

export enum AuditStatus {
  Pending = 'pending',
  Crawling = 'crawling',
  BatchComplete = 'batch_complete',
  Checking = 'checking',
  Completed = 'completed',
  Failed = 'failed',
  Stopped = 'stopped',
}

export enum CheckType {
  SEO = 'seo',
  AIReadiness = 'ai_readiness',
  Technical = 'technical',
}

export enum CheckPriority {
  Critical = 'critical',
  Recommended = 'recommended',
  Optional = 'optional',
}

export enum CheckStatus {
  Passed = 'passed',
  Failed = 'failed',
  Warning = 'warning',
}

// =============================================================================
// Performance Audit Enums
// =============================================================================

export enum PerformanceAuditStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Stopped = 'stopped',
}

export enum CWVRating {
  Good = 'good',
  NeedsImprovement = 'needs_improvement',
  Poor = 'poor',
}

export enum DeviceType {
  Mobile = 'mobile',
  Desktop = 'desktop',
}

// =============================================================================
// AIO Audit Enums
// =============================================================================

export enum AIOAuditStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export enum AIOCheckCategory {
  TechnicalFoundation = 'technical_foundation',
  ContentStructure = 'content_structure',
  ContentQuality = 'content_quality',
}

// =============================================================================
// Organization Enums
// =============================================================================

export enum OrganizationStatus {
  Prospect = 'prospect',
  Customer = 'customer',
  Inactive = 'inactive',
}

// =============================================================================
// User & Permissions Enums
// =============================================================================

export enum UserRole {
  Admin = 'admin',
  Developer = 'developer',
  TeamMember = 'team_member',
  ClientViewer = 'client_viewer',
}

// =============================================================================
// Campaign Enums
// =============================================================================

export enum CampaignStatus {
  Draft = 'draft',
  Active = 'active',
  Disabled = 'disabled',
  Completed = 'completed',
}

// =============================================================================
// Feedback Enums
// =============================================================================

export enum FeedbackCategory {
  Bug = 'bug',
  FeatureRequest = 'feature_request',
  Performance = 'performance',
  Usability = 'usability',
  Other = 'other',
}

export enum FeedbackStatus {
  New = 'new',
  UnderReview = 'under_review',
  InProgress = 'in_progress',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum FeedbackPriority {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

// =============================================================================
// Date/Period Enums
// =============================================================================

export enum Period {
  SevenDays = '7d',
  ThirtyDays = '30d',
  Quarter = 'quarter',
}

// =============================================================================
// Google Analytics Enums
// =============================================================================

export enum GAChannel {
  Direct = 'direct',
  OrganicSearch = 'organic search',
  Email = 'email',
  OrganicSocial = 'organic social',
  Referral = 'referral',
}

// =============================================================================
// Brandfetch Enums
// =============================================================================

export enum LogoType {
  Logo = 'logo',
  Icon = 'icon',
  Symbol = 'symbol',
}

export enum ImageFormat {
  SVG = 'svg',
  PNG = 'png',
  JPG = 'jpg',
}
