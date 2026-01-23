# PDF Export Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a polished, actionable PDF export with AI-generated executive summaries and consistent styling across audit types.

**Architecture:** Shared PDF component library, Vercel AI SDK with Anthropic for summaries, cached summaries in database, on-demand PDF generation.

**Tech Stack:** @react-pdf/renderer, Vercel AI SDK, @ai-sdk/anthropic, Supabase

---

## Phase 1: AI Summary Generation

### Task 1.1: Install Dependencies

```bash
npm install ai @ai-sdk/anthropic
```

### Task 1.2: Create AI Summary Module

**Create:** `lib/ai/summary.ts`

```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

interface SummaryInput {
  url: string
  overallScore: number | null
  pagesCrawled: number
  criticalIssues: Array<{ name: string }>
  warnings: Array<{ name: string }>
  passedCount: number
}

export async function generateExecutiveSummary(input: SummaryInput): Promise<string> {
  const { url, overallScore, pagesCrawled, criticalIssues, warnings, passedCount } = input

  const criticalList = criticalIssues.map(i => `- ${i.name}`).join('\n') || '- None'
  const warningList = warnings.map(i => `- ${i.name}`).join('\n') || '- None'

  const prompt = `Analyze this website audit and write a brief executive summary for the site owner.

Site: ${url}
Score: ${overallScore ?? 'N/A'}/100
Pages analyzed: ${pagesCrawled}

Critical issues (${criticalIssues.length}):
${criticalList}

Warnings (${warnings.length}):
${warningList}

Passed (${passedCount} checks)

Write 2-3 short paragraphs that:
- Assess overall site health in plain language
- Explain the business impact of the top 2-3 issues (e.g., "missing meta descriptions means search engines can't properly display your pages")
- Identify one quick win they could address today

Tone: Direct, helpful, professional. Write for someone who isn't technical but makes business decisions.

Maximum 120 words.`

  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-latest'),
    prompt,
    maxTokens: 300,
  })

  return text.trim()
}
```

### Task 1.3: Update Audit Runner

**Modify:** `lib/audit/runner.ts`

- Import `generateExecutiveSummary` from `lib/ai/summary`
- After calculating scores, call summary generation
- Wrap in try/catch with fallback to template summary
- Store result in `executive_summary` column

---

## Phase 2: Shared PDF Styling System

### Task 2.1: Create Shared Styles

**Create:** `lib/pdf/styles.ts`

```typescript
import { StyleSheet } from '@react-pdf/renderer'

// Selo brand colors
export const colors = {
  primary: '#1a1a1a',
  secondary: '#f5f5f0',
  accent: '#666666',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  muted: '#999999',
  border: '#eeeeee',
  white: '#ffffff',
}

// Typography
export const fonts = {
  base: 'Helvetica',
  bold: 'Helvetica-Bold',
}

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
}

// Shared base styles
export const baseStyles = StyleSheet.create({
  page: {
    padding: spacing.xl,
    fontFamily: fonts.base,
    backgroundColor: colors.white,
    fontSize: 10,
    lineHeight: 1.5,
  },
  coverPage: {
    padding: spacing.xl,
    fontFamily: fonts.base,
    backgroundColor: colors.primary,
    color: colors.white,
  },
  // ... more shared styles
})
```

### Task 2.2: Create Shared Components

**Create:** `lib/pdf/components.tsx`

Components to create:
- `CoverPage` - Logo, title, URL, date, overall score badge
- `ScoreBadge` - Circular score display with color coding
- `SectionHeader` - Consistent section titles
- `IssueCard` - Issue name, explanation, fix guidance
- `StatBar` - Horizontal stats display
- `PageFooter` - Page numbers, branding
- `ActionItem` - Numbered action list items

### Task 2.3: Create Logo Utility

**Create:** `lib/pdf/logo.ts`

- Move `getLogoDataUri()` function here
- Export for use by both audit types

---

## Phase 3: Audit PDF Rewrite

### Task 3.1: Add Check Descriptions

**Modify:** `lib/audit/checks/*.ts`

Add to each check definition:
```typescript
{
  name: 'missing_meta_description',
  displayName: 'Missing Meta Description',
  description: 'Meta descriptions help search engines understand your page content.',
  fixGuidance: 'Add a unique 150-160 character description to each page\'s <meta name="description"> tag.',
  // ... existing fields
}
```

### Task 3.2: Update Check Types

**Modify:** `lib/audit/types.ts`

Add new optional fields to check type:
- `description?: string`
- `fix_guidance?: string`

### Task 3.3: Rewrite Audit PDF

**Rewrite:** `lib/audit/pdf.tsx`

New structure:
1. **Cover Page**
   - Selo logo centered
   - "Website Audit Report"
   - URL and date
   - Large overall score badge

2. **Executive Summary + Findings**
   - AI-generated summary (from DB)
   - Stats bar: Pages | Critical | Warnings | Passed
   - Issues grouped by priority (Critical first)
   - Each issue shows: name, description, fix guidance
   - Footer: "✓ X checks passed"

3. **Action Plan**
   - "Priority Actions" header
   - Numbered list of top issues to address
   - Grouped by urgency
   - Compact Selo contact footer

---

## Phase 4: Performance PDF Update

### Task 4.1: Update Performance PDF

**Modify:** `lib/performance/pdf.tsx`

- Import shared styles and components from `lib/pdf/`
- Use same CoverPage, PageFooter components
- Keep performance-specific content (Lighthouse scores, Core Web Vitals)
- Match visual style with audit PDF

---

## Phase 5: Testing & Verification

### Task 5.1: Manual Testing

1. Run site audit, verify AI summary generates
2. Export PDF, check all 3 pages render correctly
3. Verify issues show description + fix guidance
4. Test performance PDF still works with new shared styles
5. Test fallback when ANTHROPIC_API_KEY is not set

### Task 5.2: Build Verification

```bash
npm run lint
npm run build
```

---

## Environment Variables

Add to `.env.local` and Vercel:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Future Enhancements (Noted)

- System-level model configuration (switch between OpenAI/Anthropic)
- Customer branding option (use org's logo and colors)
- PDF template variants (detailed vs summary)
