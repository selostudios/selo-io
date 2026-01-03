# Selo IO - Marketing Performance Dashboard Design

**Date:** January 2, 2026
**Status:** Design Approved
**Target User:** Marketing consultants managing multiple client campaigns

## Executive Summary

Selo IO is a multi-tenant SaaS platform that automates marketing performance tracking and reporting for consultants. The MVP enables consultants to track campaign performance across HubSpot, Google Analytics, and LinkedIn, with automated weekly AI-generated summaries.

## Business Context

**Current Pain Points:**
- Manual data aggregation from multiple platforms (HubSpot, GA, LinkedIn, Meta, Instagram)
- Time-consuming weekly and quarterly client reporting
- No unified view of campaign performance across platforms

**Target Users:**
- Primary: Selo Studios (marketing consultant - starting with client "Badger")
- Future: Scale to serve other marketing consultants (SaaS model)

**Reporting Cadence:**
- Weekly: Concise bullet-point summaries
- Quarterly: Exhaustive reports with trends, analysis, strategic recommendations

## MVP Feature Set

### 1. Multi-Tenant Client Management

**Organization Management:**
- Admins create organizations (one per client)
- Organization branding: logo upload, custom colors (primary, secondary, accent)
- Default weekly report recipient list (comma-delimited emails)
- AI provider configuration per org (Anthropic/OpenAI/disabled)
- Data export capability (JSON/CSV for compliance)

**User Management:**
- Invite-only system
- Auth methods: Email/password, Google OAuth, Microsoft OAuth (Supabase Auth)
- Roles: Admin, Team Member, Client Viewer
- Invite expiration: 7 days
- Bootstrap: Seed script creates first admin user

**Data Isolation:**
- Supabase Row-Level Security (RLS) enforces org boundaries
- No cross-org data leakage possible

### 2. Campaign Management

**Campaign Creation:**
- Fields: name, start/end dates, status (draft/active/completed)
- Auto-generate UTM parameters (source, medium, campaign, term, content)
- Display UTM codes for copy/paste into native platforms
- Campaign-level weekly report recipients (overrides org default)

**Campaign Operations:**
- Hard delete with cascade to metrics
- One campaign = unified UTM parameters across all platforms
- Team manually creates content in native platforms using provided UTM codes

### 3. Platform Integrations

**Supported Platforms (MVP):**
- HubSpot: Email campaign stats, leads, deals, event RSVPs
- Google Analytics 4: Page views, sessions, UTM-tagged traffic, conversions
- LinkedIn Marketing API: Post impressions, engagement, follower growth

**Integration Architecture:**
- Server-side adapter pattern per platform
- Encrypted credential storage (pgcrypto in Supabase)
- On-demand data refresh (manual "Refresh Data" button)
- 1-hour cache to avoid API rate limits
- Normalize platform data to standard metrics in `campaign_metrics` table

**Future Platforms:**
- Meta (Facebook)
- Instagram
- AI search tracking (ChatGPT, Perplexity mentions)

### 4. Performance Dashboard

**Layout:**
- Sidebar navigation: Clients (admin only), Campaigns, Dashboard, Settings
- Header: Organization selector, Refresh Data button, User menu
- Minimalist design: Neutral palette (blacks, grays, beiges), Shadcn UI components

**Dashboard Views:**

**Overview Dashboard:**
- Key metric cards: Total Reach, Engagement Rate, Leads Generated, Deals Won
- Platform breakdown sections (HubSpot, LinkedIn, Google Analytics)
- Last updated timestamp

**Campaign Detail View:**
- Campaign selector dropdown
- Time range picker (week, month, quarter, year)
- Campaign-specific metrics
- Platform breakdown for selected campaign
- UTM parameters displayed

**Weekly Summaries Archive:**
- List of all generated summaries
- Preview and resend options

**Error Handling:**
- Graceful degradation on API failures
- Empty states with helpful CTAs
- Partial data display (don't block if one platform fails)

### 5. Weekly Summary Automation

**Vercel Cron Job:**
- Schedule: Every Monday 9 AM
- Process all active organizations

**Generation Logic:**
1. Fetch last 7 days of metrics per campaign
2. Use Anthropic Claude (via Vercel AI SDK) to generate bullet points
3. Format: "Instagram Weekly Impressions: X", "Top Performing Post: [title] - [link]"
4. Store in `weekly_summaries` table
5. Send email to campaign-level or org-level recipients
6. Mark as sent with timestamp

**Email Template:**
- Clean, text-based bullet points
- Branded with org colors/logo (future enhancement)
- No attachments in MVP

**Edge Cases:**
- No active campaigns → skip org, no email sent
- No metrics for week → send email noting "No activity this week"
- Email failure → retry 3x, log failure, notify admin

### 6. AI Configuration

**Per-Organization Settings:**
- AI provider: Anthropic (recommended), OpenAI, or disabled
- Billing model: Bring own API key OR platform-billed (future)
- Enabled features: Weekly summaries (MVP), content generation (future), sentiment analysis (future)

**Default (MVP):**
- Anthropic Claude 3.5 Sonnet
- Platform provides API key initially
- Future: usage tracking and per-org billing

## Architecture

### Tech Stack

**Frontend:**
- Next.js 14+ App Router
- React Server Components
- TypeScript
- Shadcn UI + Tailwind CSS (customized to Selo Studios neutral palette)

**Backend:**
- Next.js API Routes (Vercel Edge Functions)
- Supabase PostgreSQL with Row-Level Security
- Supabase Auth (email/password, Google, Microsoft OAuth)
- Vercel Cron Jobs for weekly summaries

**Storage:**
- Supabase PostgreSQL (structured data)
- Vercel Blob or Supabase Storage (logo uploads)

**AI:**
- Vercel AI SDK
- Anthropic Claude (default)
- OpenAI GPT-4 (optional per org)

**Hosting:**
- Vercel (maximizes platform features as requested)

### Database Schema

**organizations**
- id, name, industry, contact_info, brand_preferences
- logo_url, primary_color, secondary_color, accent_color
- default_weekly_report_recipients (text[])
- ai_provider, ai_api_key (encrypted), ai_billing_model, ai_features_enabled
- data_export_history (JSON)
- created_at, updated_at

**users**
- id (Supabase Auth user ID)
- organization_id (FK)
- role (enum: admin, team_member, client_viewer)
- created_at, updated_at

**invites**
- id, email, organization_id (FK)
- role, invited_by (FK to users)
- status (enum: pending, accepted, expired)
- created_at, expires_at (7 days), accepted_at

**campaigns**
- id, organization_id (FK)
- name, start_date, end_date, status (enum: draft, active, completed)
- utm_source, utm_medium, utm_campaign, utm_term, utm_content
- weekly_report_recipients (text[], overrides org default)
- created_at, updated_at

**platform_connections**
- id, organization_id (FK)
- platform_type (enum: hubspot, google_analytics, linkedin, meta, instagram)
- credentials (encrypted JSON)
- status, last_sync_at
- created_at, updated_at

**campaign_metrics** (time-series)
- id, campaign_id (FK), platform_type
- date, metric_type, value
- Examples: impressions, clicks, followers, engagement_rate, leads, deals
- created_at
- Indexes: (campaign_id, date), (platform_type, date)
- Future: Partition by date for performance

**weekly_summaries**
- id, organization_id (FK)
- week_start_date, generated_at
- summary_data (JSON: bullet points)
- recipients (text[]: who was emailed)
- email_sent_at
- created_at

### Platform Integration Adapters

**Adapter Pattern:**
Each platform has a server-side adapter that:
1. Authenticates using encrypted credentials
2. Fetches raw data from platform API
3. Normalizes to standard metrics
4. Returns data for storage in `campaign_metrics`

**HubSpot Adapter:**
- API: HubSpot API v3
- Metrics: email opens, clicks, open_rate, CTR, leads_generated, deals_created, event_rsvps
- Attribution: Partial (needs strengthening in future)

**Google Analytics Adapter:**
- API: GA4 Data API
- Metrics: sessions, page_views, bounce_rate, conversion_rate, utm_source traffic

**LinkedIn Adapter:**
- API: LinkedIn Marketing API (requires Marketing Developer Platform access)
- Metrics: impressions, engagement_rate, followers_gained, shares, likes, comments

**Rate Limiting:**
- Cache platform responses for 1 hour
- Exponential backoff on failures
- Partial data display (don't block dashboard if one platform fails)

### Security

**Authentication & Authorization:**
- Supabase Auth with JWT tokens
- RLS policies enforce org-level isolation
- API routes verify user permissions before data access
- Role-based access control at database level

**Data Protection:**
- API credentials encrypted at rest (pgcrypto)
- Credentials never exposed to client/browser
- HTTPS enforced (Vercel)
- Secure cookie flags for auth tokens

**Compliance:**
- GDPR: Data export feature (right to data portability)
- Data deletion: Hard delete on request
- Audit logs for sensitive operations

**Vulnerability Management:**
- Dependabot for dependency updates
- Input validation on all user-submitted data
- CORS properly configured

### Performance & Scalability

**Database Optimization:**
- Indexes on frequently queried fields
- Composite indexes for time-series queries
- Future: Partition `campaign_metrics` by date
- Connection pooling via Supabase (PgBouncer)

**API Performance:**
- Server-side caching (1-hour TTL)
- Lazy loading for dashboard components
- React Suspense for async data
- Pagination for large datasets

**Frontend Optimization:**
- React Server Components (less client JS)
- Next.js Image optimization for logos
- Code splitting per route
- Future: ISR for public pages

**Scalability Targets:**
- Support 100+ organizations
- Handle 1000+ campaigns
- Process millions of metric data points
- Weekly cron completes in <5 minutes

**Monitoring:**
- Vercel Analytics for page performance
- Supabase slow query logging
- API response time tracking
- Cron job duration monitoring

## Testing Strategy

**Unit Tests (Vitest):**
- Platform adapters (mock API responses)
- UTM parameter generation
- Metric aggregation logic
- Email template rendering

**Integration Tests:**
- API route handlers
- Database operations (test Supabase instance)
- Auth flows

**E2E Tests (Playwright):**
- Admin creates org → invites user → user accepts
- Create campaign → connect platforms → view metrics
- Weekly summary generation and email delivery

**Manual QA:**
- Real platform API credentials
- Email deliverability
- Cross-browser (Chrome, Safari, Firefox)
- Mobile responsive design

## Deployment Strategy

**Environments:**
- Development: Local with Supabase local instance
- Staging: Vercel preview deployments, staging Supabase project
- Production: Vercel production, production Supabase project

**CI/CD:**
- GitHub Actions runs tests on PR
- Auto-deploy to preview on PR creation
- Manual promotion to production after QA sign-off

## Future Enhancements (Post-MVP)

**Phase 2 - Content Creation:**
- AI-powered social media content generation
- Multi-platform publishing from dashboard
- Content calendar view
- Approval workflows

**Phase 3 - Advanced Analytics:**
- Sentiment analysis across social platforms
- AI search tracking (ChatGPT, Perplexity mentions)
- Predictive insights and recommendations
- Anomaly detection and smart alerts

**Phase 4 - Expanded Integrations:**
- Meta (Facebook) and Instagram native integrations
- Paid advertising tracking (LinkedIn Ads, Google Ads)
- Event check-in iPad app (HubSpot integration)

**Phase 5 - Reporting:**
- PDF export for quarterly reports
- Email reports with dashboard deeplinks
- White-labeling for consultants

**Phase 6 - HubSpot Improvements:**
- Strengthen attribution reporting
- Automate event attendance tracking
- Enhanced lead-to-deal pipeline visibility

## Success Metrics

**User Adoption:**
- Badger (first client) fully onboarded within 2 weeks
- Weekly summaries reduce reporting time from 2 hours to 5 minutes
- 3+ additional clients onboarded within 6 months

**Technical:**
- Dashboard loads in <2 seconds
- 99.9% uptime
- Weekly cron job success rate >99%
- Zero data leakage incidents

**Business:**
- Reduce manual reporting time by 90%
- Enable consultant to scale from 1 to 5+ clients
- Future: SaaS revenue from other marketing consultants

## Design Aesthetic

**Branding (Selo Studios):**
- Minimalist, modern approach
- Clean typography, generous whitespace
- Neutral palette: blacks (#000000), warm beiges (#F5F5F0), grays (#666666)
- High-quality natural photography (future)
- Professional without being corporate

**UI Components:**
- Shadcn UI (customized theme)
- Rounded pill buttons
- Expandable table rows
- Clean data visualization (charts/graphs in future phases)
- Mobile-first responsive design

## Open Questions / Decisions Needed

1. **HubSpot Attribution:** How deeply to integrate with HubSpot's attribution features vs. rely on UTM tracking?
2. **LinkedIn API Access:** Confirm Marketing Developer Platform access for Badger's LinkedIn
3. **Event Check-in:** Priority for iPad check-in app vs. manual process?
4. **Paid Ads:** Timeline for adding LinkedIn/Meta paid advertising tracking?
5. **AI Costs:** Initial subsidy of AI costs vs. immediate pass-through to clients?

## Next Steps

1. Set up development environment (Next.js, Supabase)
2. Initialize git repository
3. Create detailed implementation plan
4. Begin Phase 1 development: Auth + Org Management
