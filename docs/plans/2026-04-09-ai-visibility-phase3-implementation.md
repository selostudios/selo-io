# AI Visibility Phase 3 — Sync Orchestrator & Budget System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the sync pipeline that queries AI platforms for each org's prompts, analyzes responses, stores results, calculates scores, and enforces per-org monthly budgets with email alerts.

**Architecture:** A `syncOrganization()` orchestrator loops through prompts × platforms, calling adapters and the analyzer pipeline from Phase 2. A budget module tracks monthly spend via `usage_logs` and stops syncing when budget is exceeded. Budget alert emails go to internal users at configurable thresholds. A cron route triggers sync for all active orgs; a server action allows on-demand sync.

**Tech Stack:** Supabase service client (bypasses RLS), React Email for budget alerts, Resend/Mailpit for delivery, existing `logUsage()` for cost tracking.

**Depends on:** Phase 2 complete (adapters in `lib/ai-visibility/platforms/`, analyzer in `lib/ai-visibility/analyzer.ts`, scorer in `lib/ai-visibility/scorer.ts`).

---

### Task 1: Migration — add competitors column to ai_visibility_configs

**Files:**

- Create: `supabase/migrations/20260409000002_ai_visibility_add_competitors.sql`

**Step 1: Write the migration**

Create `supabase/migrations/20260409000002_ai_visibility_add_competitors.sql`:

```sql
-- Add competitors configuration to AI visibility configs.
-- Stores array of { name: string, domain: string } objects.
ALTER TABLE ai_visibility_configs
ADD COLUMN competitors JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN ai_visibility_configs.competitors IS 'Array of competitor objects: [{ "name": "Zenni Optical", "domain": "zenni.com" }]';
```

**Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: Migration applies without error

**Step 3: Update TypeScript types**

Modify `lib/ai-visibility/types.ts` — update `AIVisibilityConfig` interface to add:

```typescript
competitors: {
  name: string
  domain: string
}
;[]
```

after the `budget_alert_threshold` field.

**Step 4: Commit**

```bash
git add supabase/migrations/20260409000002_ai_visibility_add_competitors.sql lib/ai-visibility/types.ts
git commit -m "feat: add competitors column to ai_visibility_configs"
```

---

### Task 2: Org context builder

Builds the `OrgContext` needed by the analyzer from org + config data.

**Files:**

- Create: `lib/ai-visibility/context.ts`
- Test: `tests/unit/lib/ai-visibility/context.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/ai-visibility/context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildOrgContext } from '@/lib/ai-visibility/context'

describe('buildOrgContext', () => {
  it('builds context from org name and website URL', () => {
    const context = buildOrgContext({
      orgName: 'Warby Parker',
      websiteUrl: 'https://www.warbyparker.com',
      competitors: [],
    })
    expect(context.brandName).toBe('Warby Parker')
    expect(context.domain).toBe('warbyparker.com')
    expect(context.competitors).toEqual([])
    expect(context.competitorDomains).toEqual({})
  })

  it('strips www from domain', () => {
    const context = buildOrgContext({
      orgName: 'Test',
      websiteUrl: 'https://www.example.com/about',
      competitors: [],
    })
    expect(context.domain).toBe('example.com')
  })

  it('handles URL without www', () => {
    const context = buildOrgContext({
      orgName: 'Test',
      websiteUrl: 'https://example.com',
      competitors: [],
    })
    expect(context.domain).toBe('example.com')
  })

  it('maps competitors to names and domain lookup', () => {
    const context = buildOrgContext({
      orgName: 'Warby Parker',
      websiteUrl: 'https://warbyparker.com',
      competitors: [
        { name: 'Zenni Optical', domain: 'zenni.com' },
        { name: 'EyeBuyDirect', domain: 'eyebuydirect.com' },
      ],
    })
    expect(context.competitors).toEqual(['Zenni Optical', 'EyeBuyDirect'])
    expect(context.competitorDomains).toEqual({
      'Zenni Optical': 'zenni.com',
      EyeBuyDirect: 'eyebuydirect.com',
    })
  })

  it('handles missing website URL gracefully', () => {
    const context = buildOrgContext({
      orgName: 'Test Co',
      websiteUrl: null,
      competitors: [],
    })
    expect(context.domain).toBe('')
  })

  it('handles malformed URL gracefully', () => {
    const context = buildOrgContext({
      orgName: 'Test Co',
      websiteUrl: 'not-a-url',
      competitors: [],
    })
    expect(context.domain).toBe('')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/ai-visibility/context.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the context builder**

Create `lib/ai-visibility/context.ts`:

```typescript
import type { OrgContext } from './analyzer'

interface OrgContextInput {
  orgName: string
  websiteUrl: string | null
  competitors: { name: string; domain: string }[]
}

function parseDomain(websiteUrl: string | null): string {
  if (!websiteUrl) return ''
  try {
    const hostname = new URL(websiteUrl).hostname.toLowerCase()
    return hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Build OrgContext for the analyzer from organization and config data.
 */
export function buildOrgContext(input: OrgContextInput): OrgContext {
  const competitorNames = input.competitors.map((c) => c.name)
  const competitorDomains: Record<string, string> = {}
  for (const c of input.competitors) {
    competitorDomains[c.name] = c.domain
  }

  return {
    brandName: input.orgName,
    domain: parseDomain(input.websiteUrl),
    competitors: competitorNames,
    competitorDomains,
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/context.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/context.ts tests/unit/lib/ai-visibility/context.test.ts
git commit -m "feat: add org context builder for AI visibility"
```

---

### Task 3: Budget module — spend tracking and budget checks

**Files:**

- Create: `lib/ai-visibility/budget.ts`
- Test: `tests/unit/lib/ai-visibility/budget.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/lib/ai-visibility/budget.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canContinueSync, checkBudgetThresholds } from '@/lib/ai-visibility/budget'

describe('canContinueSync', () => {
  it('returns true when spend is under budget', () => {
    expect(canContinueSync(5000, 10000)).toBe(true)
  })

  it('returns false when spend meets budget', () => {
    expect(canContinueSync(10000, 10000)).toBe(false)
  })

  it('returns false when spend exceeds budget', () => {
    expect(canContinueSync(12000, 10000)).toBe(false)
  })

  it('returns true when budget is 0 (unlimited)', () => {
    expect(canContinueSync(5000, 0)).toBe(true)
  })
})

describe('checkBudgetThresholds', () => {
  it('returns null when under threshold', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 5000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBeNull()
  })

  it('returns approaching when at threshold', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 9000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBe('approaching')
  })

  it('returns exceeded when over budget', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 10000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBe('exceeded')
  })

  it('returns null when approaching already sent', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 9500,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: 'approaching',
    })
    expect(result).toBeNull()
  })

  it('returns exceeded even if approaching was sent', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 10500,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: 'approaching',
    })
    expect(result).toBe('exceeded')
  })

  it('returns null when exceeded already sent', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 12000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: 'exceeded',
    })
    expect(result).toBeNull()
  })

  it('returns null when budget is 0 (unlimited)', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 50000,
      budgetCents: 0,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/ai-visibility/budget.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the budget module**

Create `lib/ai-visibility/budget.ts`:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { UsageFeature } from '@/lib/enums'

/**
 * Check if sync can continue given current spend vs budget.
 * Budget of 0 means unlimited.
 */
export function canContinueSync(currentSpendCents: number, budgetCents: number): boolean {
  if (budgetCents === 0) return true
  return currentSpendCents < budgetCents
}

interface ThresholdInput {
  currentSpendCents: number
  budgetCents: number
  thresholdPercent: number
  lastAlertType: string | null
}

/**
 * Determine if a budget alert should be sent.
 * Returns 'approaching', 'exceeded', or null (no alert needed).
 * Deduplicates: won't return the same alert type that was already sent.
 */
export function checkBudgetThresholds(input: ThresholdInput): 'approaching' | 'exceeded' | null {
  const { currentSpendCents, budgetCents, thresholdPercent, lastAlertType } = input

  if (budgetCents === 0) return null

  const spendPercent = (currentSpendCents / budgetCents) * 100

  if (spendPercent >= 100 && lastAlertType !== 'exceeded') {
    return 'exceeded'
  }

  if (spendPercent >= thresholdPercent && lastAlertType === null) {
    return 'approaching'
  }

  return null
}

/**
 * Get current month's AI Visibility spend for an org from usage_logs.
 */
export async function getCurrentMonthSpend(organizationId: string): Promise<number> {
  const supabase = createServiceClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('usage_logs')
    .select('cost')
    .eq('organization_id', organizationId)
    .eq('feature', UsageFeature.AIVisibility)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    console.error('[AI Visibility Budget]', {
      type: 'spend_query_failed',
      organizationId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return 0
  }

  return (data ?? []).reduce((sum, row) => sum + (row.cost ?? 0), 0)
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/budget.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/budget.ts tests/unit/lib/ai-visibility/budget.test.ts
git commit -m "feat: add budget tracking and threshold checks"
```

---

### Task 4: Budget alert email template

**Files:**

- Create: `emails/ai-visibility-budget-alert.tsx`

**Step 1: Create the email template**

Create `emails/ai-visibility-budget-alert.tsx`:

```tsx
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

interface AIVisibilityBudgetAlertProps {
  orgName: string
  alertType: 'approaching' | 'exceeded'
  currentSpendCents: number
  budgetCents: number
  thresholdPercent: number
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AIVisibilityBudgetAlert({
  orgName = 'Acme Corp',
  alertType = 'approaching',
  currentSpendCents = 9000,
  budgetCents = 10000,
  thresholdPercent = 90,
}: AIVisibilityBudgetAlertProps) {
  const isExceeded = alertType === 'exceeded'
  const spendPercent = Math.round((currentSpendCents / budgetCents) * 100)

  const previewText = isExceeded
    ? `AI Visibility budget exceeded for ${orgName}`
    : `AI Visibility budget at ${spendPercent}% for ${orgName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 font-sans">
          <Container className="mx-auto max-w-xl bg-white p-8">
            <Heading className="text-xl font-semibold text-neutral-900">
              {isExceeded ? 'Budget Exceeded' : 'Budget Alert'}
            </Heading>

            <Section className="mt-4">
              <Text className="text-sm text-neutral-700">
                {isExceeded
                  ? `The AI Visibility monthly budget for ${orgName} has been exceeded. Syncing has been paused until the next billing cycle.`
                  : `The AI Visibility spend for ${orgName} has reached ${spendPercent}% of the monthly budget.`}
              </Text>
            </Section>

            <Section className="mt-4 rounded-lg bg-neutral-50 p-4">
              <Text className="text-sm font-medium text-neutral-900">
                Current spend: {formatCents(currentSpendCents)} / {formatCents(budgetCents)}
              </Text>
              <Text className="text-sm text-neutral-600">Alert threshold: {thresholdPercent}%</Text>
            </Section>

            {isExceeded && (
              <Section className="mt-4">
                <Text className="text-sm text-neutral-600">
                  To resume syncing, increase the monthly budget in the AI Visibility settings for
                  this organization.
                </Text>
              </Section>
            )}

            <Section className="mt-6 border-t border-neutral-200 pt-4">
              <Text className="text-xs text-neutral-400">
                This is an automated alert from Selo IO.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
```

**Step 2: Verify it renders**

Run: `npm run email`
Navigate to the budget alert template in the React Email preview. Verify it renders correctly.

**Step 3: Commit**

```bash
git add emails/ai-visibility-budget-alert.tsx
git commit -m "feat: add budget alert email template"
```

---

### Task 5: Budget alert sender

Sends budget alert emails to internal users and updates the config.

**Files:**

- Create: `lib/ai-visibility/alerts.ts`
- Test: `tests/unit/lib/ai-visibility/alerts.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/lib/ai-visibility/alerts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
}))

import { sendBudgetAlert } from '@/lib/ai-visibility/alerts'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/client'

describe('sendBudgetAlert', () => {
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockEq = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Chain: from('users').select(...).eq('is_internal', true)
    mockEq.mockResolvedValue({
      data: [{ email: 'alice@selo.co' }, { email: 'bob@selo.co' }],
      error: null,
    })
    mockSelect.mockReturnValue({ eq: mockEq })

    // Chain: from('ai_visibility_configs').update(...).eq('organization_id', ...)
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'users') return { select: mockSelect }
        if (table === 'ai_visibility_configs') return { update: mockUpdate }
        return {}
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  it('sends emails to all internal users', async () => {
    await sendBudgetAlert({
      organizationId: 'org-1',
      orgName: 'Warby Parker',
      alertType: 'approaching',
      currentSpendCents: 9000,
      budgetCents: 10000,
      thresholdPercent: 90,
    })

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@selo.co',
        subject: expect.stringContaining('Warby Parker'),
      })
    )
  })

  it('updates config with alert type and timestamp', async () => {
    await sendBudgetAlert({
      organizationId: 'org-1',
      orgName: 'Warby Parker',
      alertType: 'exceeded',
      currentSpendCents: 11000,
      budgetCents: 10000,
      thresholdPercent: 90,
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        last_alert_type: 'exceeded',
      })
    )
  })

  it('does not throw if email sending fails', async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      data: null,
      error: { message: 'Failed' },
    })

    await expect(
      sendBudgetAlert({
        organizationId: 'org-1',
        orgName: 'Test',
        alertType: 'approaching',
        currentSpendCents: 9000,
        budgetCents: 10000,
        thresholdPercent: 90,
      })
    ).resolves.not.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/ai-visibility/alerts.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the alerts module**

Create `lib/ai-visibility/alerts.ts`:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/client'
import AIVisibilityBudgetAlert from '@/emails/ai-visibility-budget-alert'

interface BudgetAlertInput {
  organizationId: string
  orgName: string
  alertType: 'approaching' | 'exceeded'
  currentSpendCents: number
  budgetCents: number
  thresholdPercent: number
}

/**
 * Send budget alert emails to all internal users and update config.
 * Fire-and-forget: never throws.
 */
export async function sendBudgetAlert(input: BudgetAlertInput): Promise<void> {
  const { organizationId, orgName, alertType, currentSpendCents, budgetCents, thresholdPercent } =
    input

  try {
    const supabase = createServiceClient()

    // Get all internal user emails
    const { data: internalUsers, error: usersError } = await supabase
      .from('users')
      .select('email')
      .eq('is_internal', true)

    if (usersError || !internalUsers?.length) {
      console.error('[AI Visibility Alert]', {
        type: 'no_internal_users',
        organizationId,
        error: usersError?.message,
        timestamp: new Date().toISOString(),
      })
      return
    }

    const subject =
      alertType === 'exceeded'
        ? `Budget exceeded: ${orgName} AI Visibility syncs paused`
        : `Budget alert: ${orgName} AI Visibility at ${Math.round((currentSpendCents / budgetCents) * 100)}%`

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Selo IO <onboarding@resend.dev>'

    // Send to each internal user
    await Promise.all(
      internalUsers.map((user) =>
        sendEmail({
          from: fromEmail,
          to: user.email,
          subject,
          react: AIVisibilityBudgetAlert({
            orgName,
            alertType,
            currentSpendCents,
            budgetCents,
            thresholdPercent,
          }),
        })
      )
    )

    // Update config to prevent duplicate alerts
    await supabase
      .from('ai_visibility_configs')
      .update({
        last_alert_type: alertType,
        last_alert_sent_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
  } catch (error) {
    console.error('[AI Visibility Alert]', {
      type: 'alert_send_failed',
      organizationId,
      alertType,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/alerts.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/alerts.ts tests/unit/lib/ai-visibility/alerts.test.ts
git commit -m "feat: add budget alert email sender"
```

---

### Task 6: Sync orchestrator — single org sync

The core function that syncs one organization: queries all prompts across platforms, analyzes responses, stores results, calculates score.

**Files:**

- Create: `lib/ai-visibility/sync.ts`
- Test: `tests/unit/lib/ai-visibility/sync.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/lib/ai-visibility/sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIPlatform, BrandSentiment } from '@/lib/enums'

// Mock all external dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/platforms/registry', () => ({
  getAdapter: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/analyzer', () => ({
  analyzeResponse: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/budget', () => ({
  getCurrentMonthSpend: vi.fn(),
  canContinueSync: vi.fn(),
  checkBudgetThresholds: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/alerts', () => ({
  sendBudgetAlert: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/scorer', () => ({
  calculateVisibilityScore: vi.fn(),
}))

vi.mock('@/lib/ai-visibility/context', () => ({
  buildOrgContext: vi.fn(),
}))

vi.mock('@/lib/app-settings/usage', () => ({
  logUsage: vi.fn(),
}))

import { syncOrganization } from '@/lib/ai-visibility/sync'
import { getAdapter } from '@/lib/ai-visibility/platforms/registry'
import { analyzeResponse } from '@/lib/ai-visibility/analyzer'
import {
  getCurrentMonthSpend,
  canContinueSync,
  checkBudgetThresholds,
} from '@/lib/ai-visibility/budget'
import { sendBudgetAlert } from '@/lib/ai-visibility/alerts'
import { calculateVisibilityScore } from '@/lib/ai-visibility/scorer'
import { buildOrgContext } from '@/lib/ai-visibility/context'
import { createServiceClient } from '@/lib/supabase/server'

describe('syncOrganization', () => {
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockSelectPrompts = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: budget OK
    vi.mocked(getCurrentMonthSpend).mockResolvedValue(1000)
    vi.mocked(canContinueSync).mockReturnValue(true)
    vi.mocked(checkBudgetThresholds).mockReturnValue(null)

    // Default: adapter returns a response
    const mockAdapter = {
      platform: AIPlatform.ChatGPT,
      query: vi.fn().mockResolvedValue({
        text: 'Brand X is great.',
        citations: [],
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 200,
        costCents: 3,
      }),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter)

    // Default: analyzer result
    vi.mocked(analyzeResponse).mockResolvedValue({
      brand_mentioned: true,
      brand_sentiment: BrandSentiment.Positive,
      brand_position: 1,
      domain_cited: false,
      cited_urls: [],
      competitor_mentions: null,
      sentiment_cost_cents: 1,
    })

    // Default: org context
    vi.mocked(buildOrgContext).mockReturnValue({
      brandName: 'Test Brand',
      domain: 'testbrand.com',
      competitors: [],
    })

    // Default: score
    vi.mocked(calculateVisibilityScore).mockReturnValue(75)

    // Supabase mock chains
    mockInsert.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockSelectPrompts.mockResolvedValue({
      data: [
        { id: 'prompt-1', prompt_text: 'Tell me about Test Brand' },
        { id: 'prompt-2', prompt_text: 'Best brands in category' },
      ],
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'ai_visibility_prompts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: mockSelectPrompts,
              }),
            }),
          }
        }
        if (table === 'ai_visibility_results') return { insert: mockInsert }
        if (table === 'ai_visibility_scores') return { insert: mockInsert }
        if (table === 'ai_visibility_configs') return { update: mockUpdate }
        return {}
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  it('queries each prompt on each platform and stores results', async () => {
    const result = await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: {
        id: 'config-1',
        organization_id: 'org-1',
        platforms: [AIPlatform.ChatGPT],
        monthly_budget_cents: 10000,
        budget_alert_threshold: 90,
        last_alert_type: null,
        last_alert_sent_at: null,
        competitors: [],
        sync_frequency: 'daily',
        is_active: true,
        last_sync_at: null,
        created_at: '',
        updated_at: '',
      },
    })

    // 2 prompts × 1 platform = 2 queries
    expect(result.queriesCompleted).toBe(2)
    expect(result.totalCostCents).toBeGreaterThan(0)
    expect(result.budgetExceeded).toBe(false)
  })

  it('stops syncing when budget is exceeded mid-run', async () => {
    // Allow first query, block second
    vi.mocked(canContinueSync)
      .mockReturnValueOnce(true) // initial check
      .mockReturnValueOnce(true) // before prompt-1
      .mockReturnValueOnce(false) // before prompt-2

    const result = await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: {
        id: 'config-1',
        organization_id: 'org-1',
        platforms: [AIPlatform.ChatGPT],
        monthly_budget_cents: 100,
        budget_alert_threshold: 90,
        last_alert_type: null,
        last_alert_sent_at: null,
        competitors: [],
        sync_frequency: 'daily',
        is_active: true,
        last_sync_at: null,
        created_at: '',
        updated_at: '',
      },
    })

    expect(result.queriesCompleted).toBe(1)
    expect(result.budgetExceeded).toBe(true)
  })

  it('sends budget alert when threshold is crossed', async () => {
    vi.mocked(checkBudgetThresholds).mockReturnValue('approaching')

    await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: {
        id: 'config-1',
        organization_id: 'org-1',
        platforms: [AIPlatform.ChatGPT],
        monthly_budget_cents: 10000,
        budget_alert_threshold: 90,
        last_alert_type: null,
        last_alert_sent_at: null,
        competitors: [],
        sync_frequency: 'daily',
        is_active: true,
        last_sync_at: null,
        created_at: '',
        updated_at: '',
      },
    })

    expect(sendBudgetAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: 'approaching',
        orgName: 'Test Brand',
      })
    )
  })

  it('skips entirely when budget already exceeded', async () => {
    vi.mocked(canContinueSync).mockReturnValue(false)

    const result = await syncOrganization({
      organizationId: 'org-1',
      orgName: 'Test Brand',
      websiteUrl: 'https://testbrand.com',
      config: {
        id: 'config-1',
        organization_id: 'org-1',
        platforms: [AIPlatform.ChatGPT],
        monthly_budget_cents: 100,
        budget_alert_threshold: 90,
        last_alert_type: null,
        last_alert_sent_at: null,
        competitors: [],
        sync_frequency: 'daily',
        is_active: true,
        last_sync_at: null,
        created_at: '',
        updated_at: '',
      },
    })

    expect(result.queriesCompleted).toBe(0)
    expect(result.budgetExceeded).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/ai-visibility/sync.test.ts`
Expected: FAIL — module does not exist

**Step 3: Create the sync orchestrator**

Create `lib/ai-visibility/sync.ts`:

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { getAdapter } from './platforms/registry'
import { analyzeResponse } from './analyzer'
import { buildOrgContext } from './context'
import { getCurrentMonthSpend, canContinueSync, checkBudgetThresholds } from './budget'
import { sendBudgetAlert } from './alerts'
import { calculateVisibilityScore } from './scorer'
import { logUsage } from '@/lib/app-settings/usage'
import { UsageFeature } from '@/lib/enums'
import type { AIPlatform, BrandSentiment } from '@/lib/enums'
import type { AIVisibilityConfig } from './types'

interface SyncInput {
  organizationId: string
  orgName: string
  websiteUrl: string | null
  config: AIVisibilityConfig
}

interface SyncResult {
  queriesCompleted: number
  totalCostCents: number
  budgetExceeded: boolean
  errors: { promptId: string; platform: string; error: string }[]
}

/**
 * Sync AI visibility data for a single organization.
 * Queries each prompt on each platform, analyzes responses, stores results, and calculates score.
 */
export async function syncOrganization(input: SyncInput): Promise<SyncResult> {
  const { organizationId, orgName, websiteUrl, config } = input
  const supabase = createServiceClient()

  const result: SyncResult = {
    queriesCompleted: 0,
    totalCostCents: 0,
    budgetExceeded: false,
    errors: [],
  }

  // Check budget before starting
  const currentSpend = await getCurrentMonthSpend(organizationId)
  if (!canContinueSync(currentSpend, config.monthly_budget_cents)) {
    result.budgetExceeded = true
    return result
  }

  // Fetch active prompts
  const { data: prompts, error: promptsError } = await supabase
    .from('ai_visibility_prompts')
    .select('id, prompt_text')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (promptsError || !prompts?.length) {
    if (promptsError) {
      console.error('[AI Visibility Sync]', {
        type: 'prompts_fetch_failed',
        organizationId,
        error: promptsError.message,
        timestamp: new Date().toISOString(),
      })
    }
    return result
  }

  const orgContext = buildOrgContext({
    orgName,
    websiteUrl,
    competitors: config.competitors,
  })

  let runningSpend = currentSpend
  const allSentiments: BrandSentiment[] = []
  let mentionedCount = 0
  let citedCount = 0
  const platformBreakdown: Record<string, { mentions: number; citations: number }> = {}
  const allCitedUrls = new Set<string>()
  const queriedAt = new Date().toISOString()

  // Query each prompt on each platform
  for (const prompt of prompts) {
    for (const platform of config.platforms) {
      // Check budget before each query
      if (!canContinueSync(runningSpend, config.monthly_budget_cents)) {
        result.budgetExceeded = true
        break
      }

      try {
        const adapter = getAdapter(platform)
        const response = await adapter.query(prompt.prompt_text)
        const analysis = await analyzeResponse(response, orgContext)

        // Calculate total cost for this query (adapter + sentiment)
        const queryCost = response.costCents + analysis.sentiment_cost_cents
        runningSpend += queryCost
        result.totalCostCents += queryCost
        result.queriesCompleted++

        // Track aggregates for scoring
        if (analysis.brand_mentioned) {
          mentionedCount++
          allSentiments.push(analysis.brand_sentiment as BrandSentiment)
        }
        if (analysis.domain_cited) {
          citedCount++
          analysis.cited_urls.forEach((url) => allCitedUrls.add(url))
        }

        // Platform breakdown
        if (!platformBreakdown[platform]) {
          platformBreakdown[platform] = { mentions: 0, citations: 0 }
        }
        if (analysis.brand_mentioned) platformBreakdown[platform].mentions++
        if (analysis.domain_cited) platformBreakdown[platform].citations++

        // Store result
        await supabase.from('ai_visibility_results').insert({
          prompt_id: prompt.id,
          organization_id: organizationId,
          platform,
          response_text: response.text,
          brand_mentioned: analysis.brand_mentioned,
          brand_sentiment: analysis.brand_sentiment,
          brand_position: analysis.brand_position,
          domain_cited: analysis.domain_cited,
          cited_urls: analysis.cited_urls,
          competitor_mentions: analysis.competitor_mentions,
          tokens_used: response.inputTokens + response.outputTokens,
          cost_cents: queryCost,
          queried_at: queriedAt,
          raw_response: null,
        })

        // Log usage for cost tracking
        await logUsage(platform === 'chatgpt' ? 'openai' : platform, 'ai_visibility_query', {
          organizationId,
          feature: UsageFeature.AIVisibility,
          tokensInput: response.inputTokens,
          tokensOutput: response.outputTokens,
          cost: queryCost,
          metadata: { promptId: prompt.id, platform },
        })
      } catch (error) {
        result.errors.push({
          promptId: prompt.id,
          platform,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error('[AI Visibility Sync]', {
          type: 'query_failed',
          organizationId,
          promptId: prompt.id,
          platform,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      }
    }

    if (result.budgetExceeded) break
  }

  // Calculate and store score (even partial results are scored)
  if (result.queriesCompleted > 0) {
    const totalPromptPlatformPairs = prompts.length * config.platforms.length
    const score = calculateVisibilityScore({
      totalPrompts: totalPromptPlatformPairs,
      mentionedCount,
      citedCount,
      sentiments: allSentiments,
    })

    const now = new Date()
    const periodStart = new Date(now)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date(periodStart)
    periodEnd.setDate(periodEnd.getDate() + 1)

    await supabase.from('ai_visibility_scores').insert({
      organization_id: organizationId,
      score,
      mentions_count: mentionedCount,
      citations_count: citedCount,
      cited_pages_count: allCitedUrls.size,
      platform_breakdown: platformBreakdown,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    })
  }

  // Update last_sync_at
  await supabase
    .from('ai_visibility_configs')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('organization_id', organizationId)

  // Check budget thresholds and send alerts
  const alertType = checkBudgetThresholds({
    currentSpendCents: runningSpend,
    budgetCents: config.monthly_budget_cents,
    thresholdPercent: config.budget_alert_threshold,
    lastAlertType: config.last_alert_type,
  })

  if (alertType) {
    await sendBudgetAlert({
      organizationId,
      orgName,
      alertType,
      currentSpendCents: runningSpend,
      budgetCents: config.monthly_budget_cents,
      thresholdPercent: config.budget_alert_threshold,
    })
  }

  return result
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/ai-visibility/sync.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/ai-visibility/sync.ts tests/unit/lib/ai-visibility/sync.test.ts
git commit -m "feat: add sync orchestrator for AI visibility"
```

---

### Task 7: Cron route

**Files:**

- Create: `app/api/cron/ai-visibility-sync/route.ts`

**Step 1: Create the cron route**

Create `app/api/cron/ai-visibility-sync/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncOrganization } from '@/lib/ai-visibility/sync'

export const maxDuration = 300

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch all active AI visibility configs with org data
  const { data: configs, error: configsError } = await supabase
    .from('ai_visibility_configs')
    .select('*, organizations!inner(name, website_url)')
    .eq('is_active', true)

  if (configsError) {
    console.error('[AI Visibility Cron]', {
      type: 'configs_fetch_failed',
      error: configsError.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 })
  }

  if (!configs?.length) {
    return NextResponse.json({ message: 'No active configs', synced: 0 })
  }

  const results: {
    organizationId: string
    orgName: string
    queriesCompleted: number
    totalCostCents: number
    budgetExceeded: boolean
    errors: number
  }[] = []

  for (const config of configs) {
    const org = (config as Record<string, unknown>).organizations as {
      name: string
      website_url: string | null
    }

    try {
      const syncResult = await syncOrganization({
        organizationId: config.organization_id,
        orgName: org.name,
        websiteUrl: org.website_url,
        config,
      })

      results.push({
        organizationId: config.organization_id,
        orgName: org.name,
        queriesCompleted: syncResult.queriesCompleted,
        totalCostCents: syncResult.totalCostCents,
        budgetExceeded: syncResult.budgetExceeded,
        errors: syncResult.errors.length,
      })

      if (syncResult.errors.length > 0) {
        console.error('[AI Visibility Cron]', {
          type: 'sync_errors',
          organizationId: config.organization_id,
          errors: syncResult.errors,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[AI Visibility Cron]', {
        type: 'org_sync_failed',
        organizationId: config.organization_id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })

      results.push({
        organizationId: config.organization_id,
        orgName: org.name,
        queriesCompleted: 0,
        totalCostCents: 0,
        budgetExceeded: false,
        errors: 1,
      })
    }
  }

  const totalSynced = results.filter((r) => r.queriesCompleted > 0).length
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

  return NextResponse.json({
    synced: totalSynced,
    total: configs.length,
    totalErrors,
    results,
  })
}
```

**Step 2: Add to vercel.json cron config**

Open `vercel.json` and add a new cron entry:

```json
{
  "schedule": "0 4 * * *",
  "path": "/api/cron/ai-visibility-sync"
}
```

This runs daily at 4 AM UTC (after the 3 AM metrics sync).

**Step 3: Commit**

```bash
git add app/api/cron/ai-visibility-sync/route.ts vercel.json
git commit -m "feat: add AI visibility sync cron job"
```

---

### Task 8: On-demand sync server action

**Files:**

- Create: `app/(authenticated)/[orgId]/ai-visibility/actions.ts`

**Step 1: Create the server action**

Create `app/(authenticated)/[orgId]/ai-visibility/actions.ts`:

```typescript
'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { syncOrganization } from '@/lib/ai-visibility/sync'
import { withAuth } from '@/lib/actions/with-auth'
import { revalidatePath } from 'next/cache'

export async function runAIVisibilitySync(orgId: string) {
  return withAuth(async (user) => {
    const supabase = createServiceClient()

    // Fetch config
    const { data: config, error: configError } = await supabase
      .from('ai_visibility_configs')
      .select('*')
      .eq('organization_id', orgId)
      .single()

    if (configError || !config) {
      return { success: false, error: 'AI Visibility not configured for this organization' }
    }

    if (!config.is_active) {
      return { success: false, error: 'AI Visibility is not active' }
    }

    // Fetch org data
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, website_url')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return { success: false, error: 'Organization not found' }
    }

    const result = await syncOrganization({
      organizationId: orgId,
      orgName: org.name,
      websiteUrl: org.website_url,
      config,
    })

    revalidatePath(`/${orgId}/ai-visibility`)

    return {
      success: true,
      queriesCompleted: result.queriesCompleted,
      totalCostCents: result.totalCostCents,
      budgetExceeded: result.budgetExceeded,
      errors: result.errors.length,
    }
  })
}
```

**Step 2: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/ai-visibility/actions.ts
git commit -m "feat: add on-demand AI visibility sync action"
```

---

### Task 9: Final verification

**Step 1: Run full lint + test + build**

Run: `npm run lint && npx vitest run tests/unit/lib/ai-visibility/ && npm run build`
Expected: ALL PASS

**Step 2: Verify new file structure**

Run: `find lib/ai-visibility -type f | sort`

Expected:

```
lib/ai-visibility/alerts.ts
lib/ai-visibility/analyzer.ts
lib/ai-visibility/budget.ts
lib/ai-visibility/context.ts
lib/ai-visibility/platforms/chatgpt/adapter.ts
lib/ai-visibility/platforms/claude/adapter.ts
lib/ai-visibility/platforms/perplexity/adapter.ts
lib/ai-visibility/platforms/registry.ts
lib/ai-visibility/platforms/types.ts
lib/ai-visibility/scorer.ts
lib/ai-visibility/sentiment.ts
lib/ai-visibility/sync.ts
lib/ai-visibility/types.ts
```

**Step 3: Push**

```bash
git push
```
