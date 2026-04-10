# AI Visibility Phase 5 — Modular Audit Architecture & AIO Migration

## Overview

Refactor the unified audit into a modular plugin system with three self-contained modules (SEO, Performance, AI Readiness), migrate standalone AIO checks into the AI Readiness module, then remove the standalone AIO system.

## Architecture

### Module Pipeline

```
                    +---------------------+
                    |   Unified Audit     |
                    |      Runner         |
                    |                     |
                    |  1. Crawl pages     |
                    |  2. Run modules     |
                    |  3. Score & store   |
                    +----+----+----+------+
                         |    |    |
              +----------+    |    +----------+
              v               v               v
        +-----------+  +-----------+  +-----------+
        |    SEO    |  |Performance|  |AI Readiness|
        |  Module   |  |  Module   |  |   Module   |
        +-----------+  +-----------+  +-----------+
        | Checks:   |  | Checks:   |  | Checks:   |
        | ~30       |  | ~8        |  | ~15       |
        |           |  |           |  |           |
        | Phases:   |  | Phases:   |  | Phases:   |
        | (none)    |  | PSI fetch |  | AI analysis|
        |           |  |           |  |           |
        | Scoring:  |  | Scoring:  |  | Scoring:  |
        | weighted  |  | weighted  |  | 50/50     |
        | checks    |  | checks    |  | checks+AI |
        +-----------+  +-----------+  +-----------+
```

Modules run in parallel after crawl completes:

```
Crawl pages (sequential)
        |
        v
+-------+-------+-------+
|  SEO  | Perf  |  AI   |  <- Promise.allSettled()
|       |       |       |
|checks |checks |checks |
|       | +PSI  | +AI   |
|score  |score  |score  |
+---+---+---+---+---+---+
    |       |       |
    v       v       v
   Overall score blend
   (SEO 0.4 + Perf 0.3 + AI 0.3)
```

### Module Plugin Interface

Each module exports an `AuditModule` conforming to:

```typescript
interface AuditModule {
  dimension: ScoreDimension // Identity + score dimension (single enum)
  checks: AuditCheckDefinition[] // All checks for this module
  runPostCrawlPhase?: (context: PostCrawlContext) => Promise<PostCrawlResult>
  calculateScore: (checks: AuditCheck[], phaseResult?: PostCrawlResult) => number
}
```

- **SEO module** — checks only, no post-crawl phase. Score = weighted check aggregation.
- **Performance module** — post-crawl phase fetches PSI data, re-runs performance checks. Score = weighted check aggregation.
- **AI Readiness module** — post-crawl phase runs Claude analysis on top pages. Score = 50% programmatic checks + 50% strategic AI score.

### Registry (Explicit Imports, Option B)

```typescript
// lib/unified-audit/modules/registry.ts
import { seoModule } from './seo'
import { performanceModule } from './performance'
import { aiReadinessModule } from './ai-readiness'

export const auditModules: AuditModule[] = [seoModule, performanceModule, aiReadinessModule]
```

Adding a future module = create the folder, add one import line here.

`ScoreDimension` enum serves as both module identifier and score dimension — no separate `AuditModuleName` enum.

## File Structure

```
lib/unified-audit/
  modules/
    registry.ts              <- Explicit imports of all 3 modules
    types.ts                 <- AuditModule interface, PostCrawlContext, etc.
    seo/
      index.ts               <- Exports seoModule: AuditModule
      scoring.ts             <- SEO-specific score calculation
    performance/
      index.ts               <- Exports performanceModule: AuditModule
      scoring.ts             <- Performance-specific score calculation
      psi-phase.ts           <- PSI post-crawl phase (moved from psi-runner.ts)
    ai-readiness/
      index.ts               <- Exports aiReadinessModule: AuditModule
      scoring.ts             <- 50/50 blend logic
      ai-phase.ts            <- Claude analysis post-crawl phase (moved from ai-runner.ts)
  checks/                    <- Checks stay where they are
    crawlability/
    meta-content/
    content-structure/
    content-quality/
    links/
    media/
    structured-data/
    security/
    performance/
    ai-visibility/           <- Enriched with 9 migrated AIO checks
    index.ts                 <- Still aggregates all checks (used by modules)
  runner.ts                  <- Refactored: loops through modules from registry
  scoring.ts                 <- Simplified: delegates to module scoring functions
```

Checks stay in their sub-category directories. Modules reference checks by their `feedsScores` dimension. Checks with multiple `feedsScores` values (e.g. `[ScoreDimension.SEO, ScoreDimension.AIReadiness]`) are picked up by both modules.

## Check Migration — AIO into AI Readiness

### Safe to Drop (9 checks — unified version is identical or superset)

- HTML structure, content depth, readability, paragraph structure, internal linking, media richness, mobile-friendly, SSL certificate, schema markup

### Checks to Migrate (9 checks — unique AIO value)

1. FAQ sections detection
2. Definition boxes detection
3. Comparison tables detection
4. Step-by-step guides detection
5. Summary sections detection
6. Citation formatting quality
7. List usage for scannability
8. JS rendering accessibility
9. Response time measurement

These move into the AI Readiness module's check set under existing sub-categories, with `feedsScores: [ScoreDimension.AIReadiness]`.

## Runner Refactor

### Full Audit Flow

```
runner.ts (simplified flow)

1. Crawl pages (unchanged)

2. Execute modules in parallel:
   for each module in auditModules (via Promise.allSettled):
     a. startTimer()
     b. Run module.checks against crawled pages
        - page-specific checks: loop pages
        - site-wide checks: run once
     c. Run module.runPostCrawlPhase() if defined
     d. Calculate module.calculateScore()
     e. Record duration in module_timings

3. Blend overall score from module scores
   (SEO * 0.4 + Performance * 0.3 + AIReadiness * 0.3)

4. Store scores + module_timings + module_statuses on audit record
```

### Re-run a Single Module

```typescript
async function rerunModule(auditId: string, dimension: ScoreDimension): Promise<void>
```

- Loads the audit and its crawled pages from DB
- Deletes existing `audit_checks` for that dimension only
- Runs the single module's checks + post-crawl phase
- Recalculates that module's score
- Recalculates overall blended score (from all modules' current scores)
- Updates `module_timings` for that dimension
- Updates audit record

No re-crawl needed.

## Database Changes

New JSONB columns on `audits` table:

- `module_timings JSONB DEFAULT '{}'` — duration in ms per module (e.g. `{ seo: 12400, performance: 8200, ai_readiness: 45000 }`)
- `module_statuses JSONB DEFAULT '{}'` — status per module (`'completed' | 'failed' | 'running'`)
- `module_errors JSONB DEFAULT '{}'` — error details per module (`{ ai_readiness: { phase: 'post_crawl', message: 'Claude API timeout', timestamp: '...' } }`)

## Error Handling

### Isolation Principle

Module failures are isolated — one module crashing never takes down the others. `Promise.allSettled` ensures all modules get a chance to run.

### Error Capture at Each Stage

| Stage                     | What's Captured           | Behavior                                                                      |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| Check execution           | Check name, error message | Individual check marked as errored, module continues to next check            |
| Post-crawl phase (PSI/AI) | Phase name, error message | Phase skipped, score calculated from checks only (100% programmatic fallback) |
| Scoring                   | Error message             | Module marked failed, no score stored for that dimension                      |

### Structured Logging

```typescript
console.error('[Unified Audit]', {
  type: 'module_failed',
  auditId,
  module: dimension,
  phase: 'post_crawl' | 'checks' | 'scoring',
  error: error.message,
  timestamp: new Date().toISOString(),
})
```

### Overall Audit Status Logic

- All modules completed -> audit status `completed`
- Some modules failed -> audit status `completed_with_errors` (new status)
- All modules failed -> audit status `failed`

Overall score is calculated from whichever modules succeeded. If one fails, the remaining modules' weights are re-proportioned.

### UI: Partial Score Tooltip

| State    | Badge                 | Tooltip                                                                                                                                               |
| -------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| All pass | Score only            | "Based on SEO, Performance, and AI Readiness"                                                                                                         |
| Partial  | Score + warning icon  | "This score only reflects [succeeded modules]. [Failed modules] encountered errors and are not included. Re-run failed modules for a complete score." |
| All fail | No score, error state | "All modules encountered errors. No score available."                                                                                                 |

Failed module tabs show an error state with failure context and a "Retry" button that calls `rerunModule(auditId, dimension)`.

## AIO Cleanup (After Migration Verified)

### Files to Delete

```
lib/aio/                          <- Entire directory
components/aio/                   <- All AIO-specific UI components
app/(authenticated)/[orgId]/aio/  <- AIO pages (if standalone routes exist)
tests/unit/lib/aio/               <- AIO tests
tests/integration/lib/aio/        <- AIO integration tests (if any)
```

### Database Cleanup

Migration to drop tables: `aio_audits`, `aio_checks`, `aio_ai_analyses`.

### Reference Cleanup

- Remove AIO nav entry from `components/navigation/child-sidebar.tsx`
- Remove AIO imports from shared files
- Remove AIO-related cron jobs if any
- Update `CLAUDE.md` to remove AIO references

Order: migrate first, verify AI Readiness module works, then delete.

## Testing Strategy

### Unit Tests (`tests/unit/lib/unified-audit/`)

| Test file                                      | Coverage                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `modules/registry.test.ts`                     | Registry exports all 3 modules, each has valid dimension, checks, and scoring function                                        |
| `modules/seo/scoring.test.ts`                  | Weighted check aggregation — empty, all-pass, all-fail, mixed                                                                 |
| `modules/performance/scoring.test.ts`          | Same patterns + PSI phase result integration                                                                                  |
| `modules/ai-readiness/scoring.test.ts`         | 50/50 blend — programmatic only, AI only, blended, edge cases (0, 100)                                                        |
| `modules/types.test.ts`                        | AuditModule interface contract — every module has required fields, checks reference valid dimensions                          |
| `runner/module-execution.test.ts`              | Parallel execution, one failure doesn't block others, module_timings recorded, module_statuses set                            |
| `runner/rerun-module.test.ts`                  | Deletes only target dimension's checks, re-executes module, recalculates overall score, updates timings                       |
| `runner/error-handling.test.ts`                | Check-level error captured, post-crawl failure falls back to programmatic, scoring failure marks failed, overall status logic |
| `runner/overall-score.test.ts`                 | Full blend (3 modules), partial blend (re-weighted), no score (all fail)                                                      |
| `checks/ai-visibility/migrated-checks.test.ts` | Each of 9 migrated AIO checks — pass/warning/fail with realistic HTML                                                         |

### Integration Tests (`tests/integration/lib/unified-audit/`)

| Test file                 | Coverage                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `module-pipeline.test.ts` | Create audit -> run all modules -> verify checks in DB -> verify scores -> verify timings/statuses            |
| `rerun-module.test.ts`    | Create audit with results -> re-run one module -> only that module's checks replaced -> overall score updated |
| `error-recovery.test.ts`  | Simulate failure -> other modules completed -> module_errors stored -> re-run -> verify recovery              |

Existing check tests stay in place and continue to pass (check files don't change).
