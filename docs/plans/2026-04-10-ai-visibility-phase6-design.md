# AI Visibility Phase 6 — Research Mode

## Overview

Add on-demand prompt querying to the AI Visibility Prompts page. Users type a prompt, see live results from each configured AI platform appearing progressively, with AI-generated insights on every result. Results are stored and count toward budget. Prompts can optionally be saved to ongoing monitoring.

## Architecture

### Data Flow

```
User enters prompt text
        |
        v
Server action: startResearch(orgId, promptText)
        |
        ├─ Budget check (warn if exceeded, allow anyway)
        ├─ Build OrgContext (brand name, domain, competitors)
        ├─ Get active platforms from ai_visibility_configs
        ├─ Generate researchId (UUID)
        |
        v
Return { researchId, platforms, budgetWarning } immediately
        |
        v
Background (via Next.js after()):
  Fire all platform queries in parallel (Promise.allSettled)
        |
        ├─ ChatGPT: adapter.query() → analyzeResponse() → generateInsight() → INSERT result
        ├─ Claude:   adapter.query() → analyzeResponse() → generateInsight() → INSERT result
        └─ Perplexity: adapter.query() → analyzeResponse() → generateInsight() → INSERT result
        |
        v
  logUsage() for each query
```

### Progressive Reveal (Polling)

Client polls `getResearchResults(researchId)` every 2 seconds. As each platform completes, its result card appears. Polling stops when all expected platforms have results or a 30-second timeout is reached.

Uses a new generic `usePolling<T>` hook shared between Research Mode and the existing audit progress polling.

### Result Storage

Results are stored in the existing `ai_visibility_results` table with:
- `prompt_id = null` (ephemeral — not linked to a tracked prompt)
- `research_id` = shared UUID grouping results from one research query
- `source = 'research'` (distinguishes from scheduled sync results)
- `insight` = AI-generated insight text

Results appear in cost tracking but not in the Prompts page's per-prompt result grouping.

### Save to Monitoring

"Save to monitoring" opens the existing Add Prompt dialog, pre-filled with the prompt text. On save, stored results are retroactively linked to the new prompt by updating `prompt_id`.

## Database Changes

New columns on `ai_visibility_results`:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `research_id` | UUID nullable | null | Groups results from one research query |
| `source` | TEXT | `'sync'` | `'sync'` or `'research'` |
| `insight` | TEXT nullable | null | AI-generated insight (research only) |

No new tables needed.

## Generic Polling Hook

### Interface

```typescript
// hooks/use-polling.ts
interface UsePollingOptions<T> {
  fetcher: () => Promise<T>
  enabled: boolean
  intervalMs?: number        // default 2000
  errorIntervalMs?: number   // default 5000
  isComplete: (data: T) => boolean
  onComplete?: (data: T) => void
}

interface UsePollingResult<T> {
  data: T | null
  isLoading: boolean
}

function usePolling<T>(options: UsePollingOptions<T>): UsePollingResult<T>
```

### Internals

`setTimeout`-based recursive polling (same proven pattern as current audit hook). Stops when `isComplete` returns true, `enabled` flips false, or component unmounts. Error backoff at `errorIntervalMs`.

### Consumers

**Research Mode:**
```typescript
const { data: results, isLoading } = usePolling({
  fetcher: () => getResearchResults(researchId),
  enabled: !!researchId,
  intervalMs: 2000,
  isComplete: (results) => results.length >= expectedPlatforms.length,
})
```

**Audit progress** (refactored from existing `use-unified-audit-polling.ts`):
```typescript
const { data: progress, isLoading } = usePolling({
  fetcher: () => fetchAuditStatus(auditId),
  enabled: shouldPoll,
  intervalMs: 2000,
  isComplete: (data) => TERMINAL_STATUSES.includes(data.status),
  onComplete: (data) => showNotification(...),
})
```

Audit-specific extras (batch continuation, stale detection, stop) stay in the audit wrapper, not in the generic hook.

## AI-Generated Insights

Every research result gets an insight via Claude Haiku, tailored to the situation:

| Situation | Insight focus |
|-----------|---------------|
| Not mentioned | Why absent, how to get mentioned |
| Mentioned, low position (2nd/3rd) | How to move up |
| Mentioned, negative sentiment | What's driving the negative tone |
| Mentioned, not cited | How to become a cited source |
| Mentioned + cited + positive | What's working, keep doing this |

### Insight prompt context

- Full response text from the platform
- Brand name + website URL
- Competitor names and domains
- Analysis results (mentioned, position, sentiment, cited, competitor mentions)

### Cost

~$0.001-0.002 per insight (Haiku). For a 3-platform research query, adds ~$0.005 total — negligible against the ~$0.02-0.05 for the platform queries themselves.

### Failure handling

If insight generation fails, the result card renders normally with the insight section hidden. No error surfaced to the user.

## Budget Handling

Research queries share the same monthly budget as scheduled syncs. If the budget is exceeded:

- The Run button stays enabled
- A warning message appears: "Budget exceeded ($104 / $100). This query will cost ~$0.05. Run anyway?"
- User clicks through to confirm
- Research queries always go through

Budget exists mainly to cap runaway scheduled syncs, not to prevent intentional ad-hoc exploration.

## Components

All components are portable — built as self-contained units that render at the bottom of the Prompts page but could be moved to a dedicated page.

### File Structure

```
components/ai-visibility/
  research-section.tsx        <- Main section: input bar + results area (page-level orchestrator)
  research-result-card.tsx    <- Single platform result card (portable)
  research-result-list.tsx    <- Stacked list of result cards with loading states (portable)

hooks/
  use-polling.ts              <- Generic polling hook (shared with audit)

lib/ai-visibility/
  research.ts                 <- startResearch(), getResearchResults()
  insights.ts                 <- generateInsight() using Claude Haiku
```

### Research Section Layout

```
┌─────────────────────────────────────────────┐
│  Research a Prompt                           │
│                                             │
│  ┌─────────────────────────────┐ ┌────────┐ │
│  │ Type a prompt to test...    │ │  Run   │ │
│  └─────────────────────────────┘ └────────┘ │
│                                             │
│  Budget: $4.20 / $100.00 used this month    │
│                                             │
│  ┌─────────────────────────────────────────┐ │
│  │ ● ChatGPT               3rd · Neutral   │ │
│  │                                         │ │
│  │ "When looking for marketing tools..."   │ │
│  │ [Show full response]                    │ │
│  │                                         │ │
│  │ ┌ Insight ────────────────────────────┐ │ │
│  │ │ Your brand appears 3rd after        │ │ │
│  │ │ HubSpot and Mailchimp. To improve:  │ │ │
│  │ │                                     │ │ │
│  │ │ • Create comparison content          │ │ │
│  │ │   targeting "you vs HubSpot"        │ │ │
│  │ │ • Pursue backlink from cited blog   │ │ │
│  │ │ • Add structured FAQ data           │ │ │
│  │ └────────────────────────────────────┘ │ │
│  │                     [Save to monitoring]│ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ ● Claude                 Not mentioned  │ │
│  │                                         │ │
│  │ "The best options for marketing..."     │ │
│  │ [Show full response]                    │ │
│  │                                         │ │
│  │ ┌ Insight ────────────────────────────┐ │ │
│  │ │ Claude's response focuses on        │ │ │
│  │ │ enterprise tools. To get mentioned: │ │ │
│  │ │                                     │ │ │
│  │ │ • Position your brand in the        │ │ │
│  │ │   enterprise category on your site  │ │ │
│  │ │ • The response cites G2 reviews —   │ │ │
│  │ │   ensure your G2 profile is active  │ │ │
│  │ └────────────────────────────────────┘ │ │
│  │                     [Save to monitoring]│ │
│  └─────────────────────────────────────────┘ │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│  │ ○ Perplexity           Loading...       │ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└─────────────────────────────────────────────┘
```

### Result Card Anatomy

- Platform icon + name (left)
- Analysis badges (right): Mentioned/Not mentioned, Cited/Not cited, Sentiment pill, Position
- Response text (truncated ~200 chars, expandable)
- Competitor mention pills (if any)
- Insight section (collapsible, open by default)
- "Save to monitoring" button (opens existing Add Prompt dialog, pre-filled)

### Loading State

Skeleton card per expected platform with spinner. Cards appear one by one as results arrive via polling.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Budget exceeded before start | Warning shown, user confirms to proceed |
| Platform query fails | That platform's card shows error state, others unaffected |
| All platforms fail | Results section shows error with "Try again" button |
| Insight generation fails | Result card renders normally, insight section hidden |
| Polling timeout (30s) | Stop polling, show arrived results + "timed out" for missing platforms |

## Server-Side Files

### `lib/ai-visibility/research.ts`

**`startResearch(orgId, promptText)`:**
1. Budget check — warn if exceeded, but proceed regardless
2. Generate `researchId` (UUID)
3. Load org config (platforms, competitors, website URL, brand name)
4. Build `OrgContext`
5. Return `{ researchId, platforms, budgetWarning }` immediately
6. Background (via `after()`): for each platform in parallel:
   - `adapter.query(promptText)`
   - `analyzeResponse(response, orgContext)`
   - `generateInsight(response, analysis, orgContext)`
   - Insert into `ai_visibility_results`
   - `logUsage()`

**`getResearchResults(researchId)`:**
1. Query `ai_visibility_results` where `research_id = researchId`
2. Return array of results

### `lib/ai-visibility/insights.ts`

**`generateInsight(response, analysis, orgContext)`:**
1. Build prompt with response text, brand context, competitor info, analysis results
2. Call Claude Haiku via `generateText()`
3. Return insight text (string) or null on failure
4. Log cost via `logUsage()`

## Testing Strategy

| Test file | Coverage |
|-----------|----------|
| `hooks/use-polling.test.ts` | Generic hook: polls at interval, stops on complete, error backoff, cleanup on unmount, onComplete callback |
| `lib/ai-visibility/research.test.ts` | startResearch: budget warning flag, parallel platform dispatch, results stored with research_id and source='research'. getResearchResults: returns only matching research_id |
| `lib/ai-visibility/insights.test.ts` | Generates correct prompt for each scenario (not mentioned, low position, negative sentiment, positive). Returns null on failure without throwing |
| `components/ai-visibility/research-section.test.tsx` | Input + Run button, budget warning display, polling starts on submit, results appear progressively |
| `components/ai-visibility/research-result-card.test.tsx` | Renders platform name + badges, shows insight when present, hides insight when null, expandable response text, Save to monitoring button |

Existing audit polling tests get refactored to use `usePolling` — no net new tests, just updating the hook under test.
