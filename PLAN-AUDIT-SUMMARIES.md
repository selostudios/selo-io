# Audit Summary & Developer Notes Feature Plan

## Overview

Add AI-generated Executive Summary and Developer Notes to all three audit types (SEO Site Audit, PageSpeed Audit, AIO Audit) using a unified, reusable component architecture.

## Goals

1. **Executive Summary**: High-level diagnosis for Selo employees reviewing customer audits
2. **Developer Notes**: Technical implementation steps and tips for engineers to fix issues
3. **Reusability**: Single component that works across all audit types
4. **Customization**: Prompt-driven approach allowing each audit type to provide context-specific guidance
5. **Consistency**: Same data structure and UI pattern across all audits

## Architecture

### 1. Database Schema Changes

**Add to `performance_audits` table:**

```sql
ALTER TABLE performance_audits
  ADD COLUMN executive_summary TEXT,
  ADD COLUMN developer_notes TEXT;
```

**Add to `aio_audits` table:**

```sql
ALTER TABLE aio_audits
  ADD COLUMN executive_summary TEXT,
  ADD COLUMN developer_notes TEXT;
```

**Already exists in `site_audits`:**

- `executive_summary` ✓ (exists)
- Need to add: `developer_notes`

```sql
ALTER TABLE site_audits
  ADD COLUMN developer_notes TEXT;
```

**Migration file:** `supabase/migrations/YYYYMMDD_add_audit_summaries.sql`

### 2. Data Structure (TypeScript)

```typescript
// lib/ai/types.ts
import { z } from 'zod'

export const AuditSummarySchema = z.object({
  summary: z.string().describe('2-3 paragraph executive summary (100 words max, plain text)'),
  developerNotes: z
    .string()
    .describe('Step-by-step technical implementation guide (markdown format)'),
})

export type AuditSummary = z.infer<typeof AuditSummarySchema>
```

### 3. AI Generation Service

**File:** `lib/ai/audit-summary.ts`

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { AuditSummarySchema } from './types'

interface GenerateAuditSummaryParams {
  summaryPrompt: string
  developerNotesPrompt: string
  auditType: 'seo' | 'performance' | 'aio'
}

export async function generateAuditSummary({
  summaryPrompt,
  developerNotesPrompt,
  auditType,
}: GenerateAuditSummaryParams): Promise<AuditSummary> {
  const { object } = await generateObject({
    model: anthropic('claude-opus-4-20250514'),
    schema: AuditSummarySchema,
    messages: [
      {
        role: 'system',
        content: `You are an expert technical writer creating audit documentation for Selo, an SEO and performance monitoring platform.

You will generate two distinct outputs:
1. Executive Summary: For Selo employees reviewing customer audits
2. Developer Notes: For engineers implementing fixes

Be specific, actionable, and concise.`,
      },
      {
        role: 'user',
        content: `Generate executive summary and developer notes for this ${auditType} audit.

# Executive Summary Instructions
${summaryPrompt}

# Developer Notes Instructions
${developerNotesPrompt}`,
      },
    ],
  })

  return object
}
```

### 4. Prompt Templates

Create prompt builder functions for each audit type:

#### **File:** `lib/ai/prompts/seo-audit.ts`

```typescript
import type { SiteAudit } from '@/lib/audit/types'

export function buildSeoSummaryPrompt(audit: {
  url: string
  overallScore: number
  seoScore: number
  technicalScore: number
  aiReadinessScore: number
  pagesCrawled: number
  criticalIssues: Array<{ name: string; failedCount: number }>
  warnings: Array<{ name: string; warningCount: number }>
}): string {
  return `Site: ${audit.url}
Overall Score: ${audit.overallScore}/100
- SEO: ${audit.seoScore}/100
- Technical: ${audit.technicalScore}/100
- AI Readiness: ${audit.aiReadinessScore}/100

Pages analyzed: ${audit.pagesCrawled}

Top Critical Issues:
${audit.criticalIssues
  .slice(0, 5)
  .map((i) => `- ${i.name} (${i.failedCount} pages)`)
  .join('\n')}

Top Warnings:
${audit.warnings
  .slice(0, 3)
  .map((w) => `- ${w.name} (${w.warningCount} pages)`)
  .join('\n')}

Write 2-3 short paragraphs:
1. Diagnose overall health (be specific about what's working/not working)
2. Business impact (traffic, conversions, visibility losses)
3. Next steps (1-2 clear recommendations)

Maximum 100 words. Plain text only.`
}

export function buildSeoDeveloperPrompt(audit: {
  url: string
  criticalIssues: Array<{
    name: string
    description: string
    failedCount: number
    learnMoreUrl?: string
  }>
  warnings: Array<{
    name: string
    description: string
    warningCount: number
    learnMoreUrl?: string
  }>
}): string {
  return `Site: ${audit.url}

Critical Issues to Fix:
${audit.criticalIssues
  .slice(0, 5)
  .map(
    (i) => `
### ${i.name} (${i.failedCount} pages affected)
${i.description}
${i.learnMoreUrl ? `Learn more: ${i.learnMoreUrl}` : ''}
`
  )
  .join('\n')}

High-Priority Warnings:
${audit.warnings
  .slice(0, 3)
  .map(
    (w) => `
### ${w.name} (${w.warningCount} pages affected)
${w.description}
${w.learnMoreUrl ? `Learn more: ${w.learnMoreUrl}` : ''}
`
  )
  .join('\n')}

Create a step-by-step implementation guide:

1. **Prioritization**: Order issues by impact (critical first)
2. **Quick Wins**: Identify fixes that can be done in < 1 day
3. **Technical Steps**: For each major issue:
   - Root cause
   - Specific code changes needed
   - Testing approach
   - Estimated effort
4. **Validation**: How to verify fixes worked

Use markdown format with headings, bullet points, and code examples where helpful.
Maximum 500 words.`
}
```

#### **File:** `lib/ai/prompts/performance-audit.ts`

```typescript
export function buildPerformanceSummaryPrompt(audit: {
  url: string
  mobileScore: number | null
  desktopScore: number | null
  totalUrls: number
  avgLCP: number | null
  avgFCP: number | null
  avgTTFB: number | null
}): string {
  return `Site: ${audit.url}
PageSpeed Scores:
- Mobile: ${audit.mobileScore || 'N/A'}/100
- Desktop: ${audit.desktopScore || 'N/A'}/100

Core Web Vitals (average):
- LCP: ${audit.avgLCP ? `${audit.avgLCP}s` : 'N/A'}
- FCP: ${audit.avgFCP ? `${audit.avgFCP}s` : 'N/A'}
- TTFB: ${audit.avgTTFB ? `${audit.avgTTFB}s` : 'N/A'}

Pages analyzed: ${audit.totalUrls}

Write 2-3 short paragraphs:
1. Performance health diagnosis (mobile vs desktop)
2. User experience impact (bounce rate, conversions)
3. Priority fixes (what will have biggest impact)

Maximum 100 words. Plain text only.`
}

export function buildPerformanceDeveloperPrompt(audit: {
  url: string
  mobileScore: number | null
  desktopScore: number | null
  opportunities: Array<{ title: string; description: string; savings: string }>
  diagnostics: Array<{ title: string; description: string }>
}): string {
  return `Site: ${audit.url}

Performance Scores: Mobile ${audit.mobileScore}/100, Desktop ${audit.desktopScore}/100

Top Opportunities:
${audit.opportunities
  .slice(0, 5)
  .map(
    (o) => `
### ${o.title}
${o.description}
Potential savings: ${o.savings}
`
  )
  .join('\n')}

Diagnostics:
${audit.diagnostics
  .slice(0, 3)
  .map(
    (d) => `
### ${d.title}
${d.description}
`
  )
  .join('\n')}

Create a performance optimization implementation plan:

1. **Critical Path**: Order fixes by impact on Core Web Vitals
2. **Infrastructure**: Server/hosting optimizations
3. **Code Changes**:
   - Image optimization steps
   - JavaScript optimization
   - CSS optimization
   - Caching strategies
4. **Testing**: How to measure improvements
5. **Monitoring**: Tools to track ongoing performance

Use markdown. Include specific commands/code where helpful.
Maximum 500 words.`
}
```

#### **File:** `lib/ai/prompts/aio-audit.ts`

```typescript
export function buildAioSummaryPrompt(audit: {
  url: string
  overallAioScore: number | null
  strategicScore: number | null
  technicalScore: number | null
  pagesAnalyzed: number
  criticalRecommendations: number
  highRecommendations: number
}): string {
  return `Site: ${audit.url}
AIO Score: ${audit.overallAioScore || 'N/A'}/100
- Strategic (AI Quality): ${audit.strategicScore || 'N/A'}/100
- Technical (AI Readiness): ${audit.technicalScore || 'N/A'}/100

Pages analyzed: ${audit.pagesAnalyzed}
Critical recommendations: ${audit.criticalRecommendations}
High-priority recommendations: ${audit.highRecommendations}

Write 2-3 short paragraphs:
1. AI Optimization readiness (how well can AI engines cite this content)
2. Visibility impact (ChatGPT, Claude, Perplexity rankings)
3. Priority actions (biggest improvements for AI discoverability)

Maximum 100 words. Plain text only.`
}

export function buildAioDeveloperPrompt(audit: {
  url: string
  programmaticChecks: Array<{
    name: string
    status: 'passed' | 'failed' | 'warning'
    description: string
  }>
  aiAnalyses: Array<{
    url: string
    dataQuality: number
    expertCredibility: number
    comprehensiveness: number
    citability: number
    recommendations: string[]
  }>
}): string {
  const failedChecks = audit.programmaticChecks.filter((c) => c.status === 'failed')
  const topAnalysis = audit.aiAnalyses[0] // Most important page

  return `Site: ${audit.url}

Failed Technical Checks:
${failedChecks
  .slice(0, 5)
  .map(
    (c) => `
### ${c.name}
${c.description}
`
  )
  .join('\n')}

AI Quality Analysis (sample page: ${topAnalysis?.url || 'N/A'}):
- Data Quality: ${topAnalysis?.dataQuality}/100
- Expert Credibility: ${topAnalysis?.expertCredibility}/100
- Comprehensiveness: ${topAnalysis?.comprehensiveness}/100
- Citability: ${topAnalysis?.citability}/100

Top Recommendations:
${
  topAnalysis?.recommendations
    .slice(0, 5)
    .map((r) => `- ${r}`)
    .join('\n') || 'None'
}

Create an AIO implementation roadmap:

1. **Quick Technical Fixes**:
   - Schema markup additions
   - FAQ sections
   - Definition boxes
2. **Content Quality Improvements**:
   - Data sourcing and citations
   - Expert quotes/credentials
   - Comprehensiveness gaps
3. **AI Crawler Optimization**:
   - robots.txt updates
   - Structured data
   - Page speed for AI crawlers
4. **Testing**: How to verify AI engines can cite content

Use markdown. Be specific about markup and content patterns.
Maximum 500 words.`
}
```

### 5. Global Component

**File:** `components/shared/audit-summary-dialog.tsx`

```typescript
'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'

interface AuditSummaryDialogProps {
  summary: string
  developerNotes: string
  auditType: 'SEO Site Audit' | 'PageSpeed Audit' | 'AIO Audit'
  url: string
  variant?: 'default' | 'outline'
  size?: 'sm' | 'default'
}

export function AuditSummaryDialog({
  summary,
  developerNotes,
  auditType,
  url,
  variant = 'outline',
  size = 'sm'
}: AuditSummaryDialogProps) {
  const [open, setOpen] = useState(false)
  const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <FileText className="mr-2 h-4 w-4" />
          Executive Summary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{auditType} Summary</DialogTitle>
          <DialogDescription>{displayUrl}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Executive Summary</TabsTrigger>
            <TabsTrigger value="developer">Developer Notes</TabsTrigger>
          </TabsList>

          <TabsContent
            value="summary"
            className="flex-1 overflow-y-auto mt-4 pr-4"
          >
            <div className="text-sm leading-relaxed space-y-3 text-foreground">
              {summary.split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </TabsContent>

          <TabsContent
            value="developer"
            className="flex-1 overflow-y-auto mt-4 pr-4"
          >
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{developerNotes}</ReactMarkdown>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

### 6. Integration Points

#### **SEO Site Audit** (`lib/audit/summary.ts`)

**Current:**

```typescript
export async function generateExecutiveSummary(...): Promise<string>
```

**New:**

```typescript
import { generateAuditSummary } from '@/lib/ai/audit-summary'
import { buildSeoSummaryPrompt, buildSeoDeveloperPrompt } from '@/lib/ai/prompts/seo-audit'

export async function generateSeoAuditSummary(
  auditData: SeoAuditData
): Promise<{ summary: string; developerNotes: string }> {
  const summaryPrompt = buildSeoSummaryPrompt(auditData)
  const developerPrompt = buildSeoDeveloperPrompt(auditData)

  return await generateAuditSummary({
    summaryPrompt,
    developerNotesPrompt: developerPrompt,
    auditType: 'seo',
  })
}
```

**When to call:**

- After all checks complete in `lib/audit/runner.ts`
- Store both `executive_summary` and `developer_notes` in DB

#### **PageSpeed Audit** (`lib/performance/summary.ts` - NEW FILE)

```typescript
import { generateAuditSummary } from '@/lib/ai/audit-summary'
import {
  buildPerformanceSummaryPrompt,
  buildPerformanceDeveloperPrompt,
} from '@/lib/ai/prompts/performance-audit'

export async function generatePerformanceAuditSummary(
  auditData: PerformanceAuditData
): Promise<{ summary: string; developerNotes: string }> {
  const summaryPrompt = buildPerformanceSummaryPrompt(auditData)
  const developerPrompt = buildPerformanceDeveloperPrompt(auditData)

  return await generateAuditSummary({
    summaryPrompt,
    developerNotesPrompt: developerPrompt,
    auditType: 'performance',
  })
}
```

**When to call:**

- After all pages processed in `api/performance/start/route.ts`
- Before setting status to 'completed'

#### **AIO Audit** (`lib/aio/summary.ts` - NEW FILE)

```typescript
import { generateAuditSummary } from '@/lib/ai/audit-summary'
import { buildAioSummaryPrompt, buildAioDeveloperPrompt } from '@/lib/ai/prompts/aio-audit'

export async function generateAioAuditSummary(
  auditData: AioAuditData
): Promise<{ summary: string; developerNotes: string }> {
  const summaryPrompt = buildAioSummaryPrompt(auditData)
  const developerPrompt = buildAioDeveloperPrompt(auditData)

  return await generateAuditSummary({
    summaryPrompt,
    developerNotesPrompt: developerPrompt,
    auditType: 'aio',
  })
}
```

**When to call:**

- After AI analysis completes in `api/aio/audit/route.ts`
- Before setting status to 'completed'

### 7. Component Updates

**Replace in:**

- `components/audit/audit-report.tsx` - Replace `ExecutiveSummaryDialog` with `AuditSummaryDialog`
- `components/performance/performance-audit-page.tsx` - Add `AuditSummaryDialog` to header
- `components/aio/aio-audit-report.tsx` - Add `AuditSummaryDialog` to header

**Example (SEO Audit):**

```tsx
{
  audit.executive_summary && audit.developer_notes && (
    <AuditSummaryDialog
      summary={audit.executive_summary}
      developerNotes={audit.developer_notes}
      auditType="SEO Site Audit"
      url={audit.url}
    />
  )
}
```

### 8. Dependencies

**Add to package.json:**

```bash
npm install react-markdown
```

**Already installed:**

- `ai` ✓
- `@ai-sdk/anthropic` ✓
- `zod` ✓

### 9. Testing Strategy

#### Unit Tests

- `tests/unit/lib/ai/audit-summary.test.ts` - Mock generateObject, test Zod validation
- `tests/unit/lib/ai/prompts/*.test.ts` - Test prompt builders return expected format

#### Integration Tests

- `tests/integration/api/audit-summary.test.ts` - Test full flow with real Opus (use fixture)
- Save real Opus responses to `tests/fixtures/audit-summaries/`

#### E2E Tests

- `tests/e2e/audit-summary.spec.ts` - Open dialog, verify tabs work, check markdown rendering

### 10. Migration & Rollout

**Phase 1: Database**

1. Run migration to add columns
2. Existing audits will have NULL values (acceptable)

**Phase 2: Component**

1. Create global `AuditSummaryDialog` component
2. Test standalone with mock data

**Phase 3: SEO Audit**

1. Update SEO audit to use new structure (already has summary)
2. Generate developer_notes on new audits
3. Replace old dialog with new one

**Phase 4: PageSpeed**

1. Add summary generation to performance audit flow
2. Add dialog to performance audit page

**Phase 5: AIO**

1. Add summary generation to AIO audit flow
2. Add dialog to AIO audit page

### 11. Error Handling

**If AI generation fails:**

```typescript
try {
  const { summary, developerNotes } = await generateAuditSummary(...)
  // Store in DB
} catch (error) {
  console.error('[Audit Summary] Failed to generate:', error)
  // Continue without summary - don't block audit completion
  // UI will hide button if both fields are null/empty
}
```

**Graceful degradation:**

- If `summary` is null → Don't show dialog button
- If `developerNotes` is null but summary exists → Show summary-only dialog
- If both exist → Show tabbed dialog

### 12. Cost Estimates

**Per audit AI generation:**

- Input: ~500 tokens (prompt + audit data)
- Output: ~600 tokens (summary 100 words + developer notes 500 words)
- Total: ~1,100 tokens
- Cost (Opus 4.5): ~$0.02 per audit

**At scale:**

- 100 audits/month: $2
- 1,000 audits/month: $20
- 10,000 audits/month: $200

**Total cost for user running all 3 audits:**

- SEO + PageSpeed + AIO = 3 × $0.02 = **$0.06 per full audit session**

### 13. File Checklist

**New Files:**

- [ ] `supabase/migrations/YYYYMMDD_add_audit_summaries.sql`
- [ ] `lib/ai/types.ts`
- [ ] `lib/ai/audit-summary.ts`
- [ ] `lib/ai/prompts/seo-audit.ts`
- [ ] `lib/ai/prompts/performance-audit.ts`
- [ ] `lib/ai/prompts/aio-audit.ts`
- [ ] `lib/performance/summary.ts`
- [ ] `lib/aio/summary.ts`
- [ ] `components/shared/audit-summary-dialog.tsx`
- [ ] `tests/unit/lib/ai/audit-summary.test.ts`
- [ ] `tests/fixtures/audit-summaries/seo-sample.json`
- [ ] `tests/fixtures/audit-summaries/performance-sample.json`
- [ ] `tests/fixtures/audit-summaries/aio-sample.json`

**Modified Files:**

- [ ] `lib/audit/types.ts` - Add `developer_notes` to SiteAudit type
- [ ] `lib/performance/types.ts` - Add summary fields to PerformanceAudit type
- [ ] `lib/aio/types.ts` - Add summary fields to AIOAudit type
- [ ] `lib/audit/summary.ts` - Refactor to use new structure
- [ ] `lib/audit/runner.ts` - Call summary generation
- [ ] `api/performance/start/route.ts` - Call summary generation
- [ ] `api/aio/audit/route.ts` - Call summary generation
- [ ] `components/audit/audit-report.tsx` - Use new dialog
- [ ] `components/performance/performance-audit-page.tsx` - Add dialog
- [ ] `components/aio/aio-audit-report.tsx` - Add dialog
- [ ] `package.json` - Add react-markdown

**Deprecated Files:**

- [ ] `components/audit/executive-summary-dialog.tsx` - Replace with shared component

### 14. Success Criteria

- [ ] All three audit types have summary + developer notes
- [ ] Single reusable component with tabs
- [ ] Markdown rendering works correctly for developer notes
- [ ] AI generation completes in < 5 seconds
- [ ] Graceful fallback if AI fails (audit still completes)
- [ ] No errors in build/lint
- [ ] Tests pass with >80% coverage
- [ ] Cost per audit < $0.03

### 15. Future Enhancements

1. **Regeneration**: Button to regenerate summary/notes for old audits
2. **Export**: Download developer notes as markdown file
3. **Customization**: Let users provide additional context for better notes
4. **Comparison**: Show diff between previous and current audit summaries
5. **AI Model Selection**: Allow choosing between Opus/Sonnet based on cost/quality tradeoff

---

## Next Steps

1. Review plan with team
2. Approve cost estimates ($0.02/audit)
3. Start with Phase 1 (database migration)
4. Implement in order: SEO → PageSpeed → AIO
5. Monitor token usage and adjust prompts if needed
