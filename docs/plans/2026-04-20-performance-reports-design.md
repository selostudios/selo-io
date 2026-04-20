# Performance Reports — Design

**Date:** 2026-04-20
**Status:** Design approved; implementation plan pending
**Owner:** Owain

## Context

The existing **Client Reports** view (`/seo/client-reports`) is returning an empty white screen for at least one known URL (`/71732fbe…/seo/client-reports/8947447a…`). The underlying data is healthy — the report row exists and points to a completed unified audit with scores (SEO 81, Perf 69, AI 68, overall 74, 921 pages).

The failure is a code-path fragility introduced when the unified audit system replaced the legacy `site_audits` / `performance_audits` / `aio_audits` tables. `getReportWithAudits` runs a Supabase join against those legacy tables (which are all NULL for unified reports), then relies on a compatibility shim to synthesize fake legacy objects from unified audit data. If the shim silently misses a path (e.g., PostgREST returns a truthy empty object for the join), the downstream `transformToPresentation` throws on `report.site_audit.overall_score`. There is no `error.tsx` anywhere in the app, so the throw produces a blank page.

Rather than patch the shim, the client-reports area is being overhauled. The trigger is a separate requirement: Selo wants a new **Performance Reports** type that is a full quarterly marketing review — not an audit report. The keynote that motivates this is a 15-slide EOS strategy deck mixing GA, LinkedIn, HubSpot, email, and narrative insight.

## Decisions

1. **Two report types, separate routes.** Rename the existing "Client Reports" → **Audit Reports** (move from `/seo/client-reports` to `/reports/audit` with a redirect). Introduce **Performance Reports** at `/reports/performance`. Both live under Home → Reports.
2. **Performance Report is a quarterly marketing review.** The audit becomes an *input* to the Takeaways/Insights section, not the report's centerpiece.
3. **Period model: quarterly, with dual comparison.** Admin picks a quarter; the system auto-compares both to the prior quarter (QoQ) and to the same quarter of the previous year (YoY). Metrics show both deltas. Charts render three series: current / prior quarter / same quarter last year.
4. **Authoring model: AI-drafted narrative, admin-editable.** Data sections auto-populate from platform data. Narrative sections (GA summary, LinkedIn content insights, Takeaways, Planning, subtitle) get AI drafts using **Claude Opus 4.7** (`claude-opus-4-7`), editable by the admin. Prompt caching enabled for re-draft cost.
5. **Global rule: every AI-generated block is editable.** Stored as `{ current, ai_original }` with a "Restore AI default" affordance.
6. **Snapshot model: immutable log.** Each publish creates a new snapshot with frozen data + narrative and its own share token. Admin can always regenerate a new snapshot; old share links keep showing the numbers they showed when presented. Supports "Leslie referring to Q3 numbers from her EOS meeting six months later."
7. **v1 slide scope** (11 slides): Cover, Agenda, Web Search Performance (consolidated metrics + referrals + AI summary), LinkedIn Performance (metrics + top-4 posts + AI insights), Email Marketing, HubSpot New Leads, Deal Sources, Marketing Initiatives (manual rich text), Key Takeaways & Insights (AI + audit findings), Next Quarter Planning (AI), Closing.
8. **Cut from v1:** Instagram (no integration), Net Promoter Score (not tracked).
9. **Aesthetic:** clean, minimalistic. Three-color palette from the org's brand colors (`primary_color`, `secondary_color`, `accent_color`). No rounded corners, no shadows, rectangles only, hairline dividers. One serif display + one sans for body. No chart gridlines beyond a single baseline. No transition animations.

## Data model

Three new tables.

### `marketing_reviews`

The report concept — one per org per quarter.

```
id                     uuid pk
organization_id        uuid fk organizations
title                  text
quarter                text    (e.g. '2026-Q1')
latest_snapshot_id     uuid    nullable, fk marketing_review_snapshots
created_by             uuid    fk users
created_at, updated_at timestamptz
```

### `marketing_review_snapshots`

Immutable point-in-time captures. Published drafts land here.

```
id                   uuid pk
review_id            uuid fk marketing_reviews
version              int       (1, 2, 3…)
published_at         timestamptz
published_by         uuid fk users

period_start         date
period_end           date
compare_qoq_start    date
compare_qoq_end      date
compare_yoy_start    date
compare_yoy_end      date

data                 jsonb     (frozen metrics from all platforms)
narrative            jsonb     (frozen narrative blocks — current + ai_original)

share_token          text unique
```

Snapshots are never mutated after insert. RLS: members of the org + internal users can read; nothing can update/delete.

### `marketing_review_drafts`

The single working copy per review.

```
id                uuid pk
review_id         uuid fk marketing_reviews (unique — one draft per review)
updated_at        timestamptz

data              jsonb     (latest fetched metrics, refreshable)
narrative         jsonb     (admin's WIP edits)
ai_originals      jsonb     (AI's original drafts for "Restore default")
```

### Workflow

1. **Create review** → draft row inserted, data fetched from GA / LinkedIn / HubSpot, AI drafts generated in parallel, admin lands on editor.
2. **Edit narrative** in-place; autosaves to draft.
3. **Refresh data** → re-fetches platform data into draft; admin confirms whether to re-run AI drafts (which overwrites narrative edits).
4. **Publish** → copy draft to a new immutable snapshot, bump `latest_snapshot_id`, mint new share token.
5. **Old snapshots + tokens remain valid forever.**

## Routes + navigation

```
/{orgId}/reports/audit                             → list (renamed from client-reports)
/{orgId}/reports/audit/{id}                        → detail (existing)
/{orgId}/reports/performance                       → list
/{orgId}/reports/performance/new                   → create form
/{orgId}/reports/performance/{id}                  → editor (working draft)
/{orgId}/reports/performance/{id}/snapshots        → snapshot history timeline
/{orgId}/reports/performance/{id}/snapshots/{sid}  → read-only view of one snapshot
/s/{token}                                          → public share (existing, add MarketingReview type)
```

Old URL `/seo/client-reports/*` returns 301 to `/reports/audit/*`. Existing share tokens (which route through `/s/{token}`) are unaffected.

Nav: ParentSidebar → Home → Reports. Two entries in the ChildSidebar: **Audit Reports** and **Performance Reports**.

### Editor UI

- Split view: slide nav sidebar + content area.
- Top bar: Refresh data · Restore AI defaults · Publish · Preview · Share.
- Each slide shows data panels (read-only) + narrative block (inline rich-text editor, "Restore AI default" ghost button).
- Autosave to draft every ~3s; unsaved-changes indicator.
- Status badge: Draft / Published v3 / Never Published.

### Creation flow

1. Admin clicks **New Review** on the list page.
2. Picks org + quarter.
3. System validates all three integrations connected + data exists in period; surfaces warnings for missing data ("HubSpot not connected — Deal Sources slide will be empty").
4. Background job fetches data + runs AI drafts (~10–20s). Streaming: admin can start editing as each block finishes.
5. Lands on editor.

### Permissions

- Create / edit / publish / delete: `admin` + internal users.
- View: any org member.

## AI generation pipeline

One module: `lib/reviews/ai/` with a generator per narrative block.

| Generator | Inputs |
|---|---|
| `generateCoverSubtitle` | quarter, top 1–2 highlight metrics |
| `generateGASummary` | current + QoQ + YoY metrics, channel breakdown, referrals |
| `generateLinkedInInsights` | current metrics + top 4 posts (title, engagement, date) |
| `generateTakeaways` | all platform data + top audit findings (critical failed checks, AI readiness issues) |
| `generatePlanning` | all platform data + takeaways + audit recommendations |

- All run in parallel on creation and on explicit "Re-draft narrative."
- Model: Claude Opus 4.7 (`claude-opus-4-7`).
- Prompt caching on the data block (5-min TTL) so re-draft iterations are cheap.
- Output: markdown, rendered in the editor via Tiptap and in the presentation via a markdown component.

### Editability

- Draft stores each block as `{ current: string, ai_original: string }`.
- Inline rich-text editor (Tiptap).
- **Restore AI default** reverts `current` to `ai_original`.
- **Re-draft with AI** re-runs the generator (confirms first — overwrites edits).
- On publish, both `current` and `ai_original` freeze into the snapshot so history is complete.

## Slide components

New directory `components/reviews/`.

- `review-presentation.tsx` — deck shell: progress dots, arrow nav, share button. Same UX shape as the existing `report-presentation.tsx` but rewritten for the new aesthetic and data model.
- `slide-container.tsx` — per-slide padding, branding, footer.
- `slides/CoverSlide`, `AgendaSlide`, `WebSearchSlide`, `LinkedInSlide`, `EmailSlide`, `HubSpotLeadsSlide`, `DealSourcesSlide`, `InitiativesSlide`, `TakeawaysSlide`, `PlanningSlide`, `ClosingSlide`.
- Shared primitives in `components/reviews/primitives/`:
  - `DualCompareMetric` — big number + two delta pills (text-only), tri-line sparkline.
  - `ComparisonChart` — three-line chart (current / prior quarter / same quarter last year).
  - `EditableNarrative` — Tiptap wrapper with Restore / Re-draft / autosave.

Presentation accepts `mode: 'editor' | 'readonly'`; editor mode shows editing affordances, readonly mode is what share viewers see.

### Aesthetic principles

- **Palette:** only the three org brand colors + neutrals (white, near-black text, one grey for dividers / subdued text). Current = primary, QoQ = secondary, YoY = accent in charts.
- **Shapes:** rectangles only. No `rounded-*`, no pills, no bordered badges. 1px hairline dividers.
- **Shadows:** none. Separation via whitespace and hairlines.
- **Typography:** one serif display, one sans. Numbers carry weight, not decoration.
- **Metric cards:** unframed — big number, small label, text-only delta pill.
- **Charts:** no gridlines beyond a single baseline; labels inline; palette-only colors.
- **Whitespace:** generous. Min 96px outer padding on the deck.
- **Motion:** none.

Review PRs enforce: no one-off colors, no `rounded-*` / `shadow-*` utilities in review components.

All top-level slide elements carry `data-testid` attributes per project convention.

## Prerequisites

**Must ship before or alongside Performance Reports:**

1. **Fix the Audit Report empty screen.** Rip out the legacy shim in `getReportWithAudits`. Rewrite `transformToPresentation` directly on `audits` + `audit_checks`. Add top-level `app/error.tsx` and `app/not-found.tsx` so future throws surface instead of blank-screening. (ETA: 1–2 days, ships as standalone PR.)
2. **LinkedIn post-level data spike.** Verify app has the right scopes for individual post analytics (`r_organization_social` minimum; Marketing Developer Platform escalation if needed). Extend `lib/platforms/linkedin/client.ts` + adapter. New `linkedin_posts` table with daily sync. Blocks the "Top content" panel only — other slides unblocked. (ETA: 2–3 days; more if scope escalation needed.)
3. **HubSpot email metrics verification.** Confirm the current adapter exposes sends / opens / CTR. Extend if not. (ETA: 0.5–2 days.)

## Rollout sequence

- **Phase 0:** Audit Report fix + `error.tsx` + `not-found.tsx`. Standalone PR, ships immediately.
- **Phase 1:** Data model migrations; route scaffolding; nav rename + 301s.
- **Phase 2:** Data pipeline (fetch → freeze → snapshot), no AI yet. Create / publish / share works with raw data.
- **Phase 3:** AI generators + editable narrative.
- **Phase 4:** Slide components — shell first, then one slide at a time.
- **Phase 5:** LinkedIn post-level integration, plugged into the LinkedIn slide.
- **Phase 6:** Share flow + public view (add `SharedResourceType.MarketingReview`).
- **Phase 7:** Full test suite — unit, integration, E2E, visual snapshots.

Phases 1–7 land on a `performance-reports` parent branch with per-phase feature branches merged in.

## Testing strategy

**Unit**
- Snapshot immutability (old snapshots never mutate after insert).
- QoQ / YoY date math (quarter boundaries, leap years, DST-free UTC).
- `ai_original` restore logic.
- Permission gates (role + internal-user matrix).
- Data-freshness checks (stale threshold, "data missing" warnings).

**Integration**
- Fetch → draft creation produces well-formed `data` blob.
- Draft → publish produces immutable snapshot with frozen token.
- Refresh preserves narrative edits unless admin opts into AI re-draft.
- Share-token resolution returns the right snapshot (not the latest draft).
- RLS: non-members blocked; internal users pass.

**E2E (Playwright)**
- Create review → edit narrative → publish → open public share → verify frozen numbers.
- Refresh data → verify draft updates but the previous published snapshot is unchanged.
- Permission flows: client_viewer cannot create; admin can.

**Visual**
- One Playwright snapshot per slide in `tests/e2e/visual.spec.ts`. Palette test renders three brand colors and verifies no out-of-palette classes.

**Before Pushing**
- Full `npm run lint && npm run test:unit && npm run build` must pass.
- Full `npm run test:e2e` for any UI changes.
- All new slide components must carry `data-testid`.

## Open questions / follow-ups

- **LinkedIn scope:** whether the current app has `r_organization_social` at the level needed for per-post analytics, or whether we need Marketing Developer Platform escalation. Spike first, then commit to the Top Content panel scope.
- **HubSpot emails:** confirm adapter surface before scoping the Email Marketing slide.
- **AI cost ceiling:** set a per-generation budget and a quarterly org-level cap; surface in admin settings if the team wants cost visibility.
- **PDF export:** deferred — separate conversation. The share link is the MVP distribution channel.
