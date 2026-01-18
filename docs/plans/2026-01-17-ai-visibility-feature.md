# AI Visibility Feature

> **Status:** Planning
> **Last updated:** 2026-01-17

---

## Changelog

| Date       | Update                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 2026-01-17 | Initial document - defined core features: AI Visibility Monitoring, Site Audit, Prospect Audit Tool |
| 2026-01-17 | Added Vercel AI SDK as implementation framework                                                     |
| 2026-01-17 | Added Otterly UX reference as baseline for user experience                                          |
| 2026-01-17 | Vercel Design Guidelines moved to `/AGENTS.md`                                                      |

---

## Project Context

> Selo is a marketing intelligence platform that unifies social, CRM, and web analytics with AI visibility tracking. One dashboard to measure your complete digital presence.

AI Visibility is a major new feature that will track how a brand appears in AI-powered search engines like ChatGPT, Perplexity, Google AI Mode, and Gemini.

**Target user:** In-house marketing teams tracking their own brand's AI presence.

---

## Reference Links

### Competitor Products

| Product                     | URL                                                              | Notes                                                              |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| SemRush AI Visibility Index | https://ai-visibility-index.semrush.com/                         | Enterprise-grade, tracks 100M+ prompts globally                    |
| SemRush Free Checker        | https://www.semrush.com/free-tools/ai-search-visibility-checker/ | Free tier for basic checks                                         |
| Otterly.ai                  | https://otterly.ai/                                              | Monitors ChatGPT, Perplexity, Google AIO, Gemini, Copilot          |
| Peec AI                     | https://peec.ai/                                                 | Marketing team focused, tracks ChatGPT, Perplexity, Claude, Gemini |
| ZipTie.dev                  | https://ziptie.dev/                                              | AI Overviews + ChatGPT + Perplexity tracker                        |
| LLMrefs                     | https://llmrefs.com/                                             | Tracks all major AI models including GPT-5, Claude, Grok, DeepSeek |

### Industry Standards & Developments

| Resource | URL                 | Description                                                                                                                         |
| -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| llms.txt | https://llmstxt.org | Proposed standard for making websites LLM-friendly. A markdown file at `/llms.txt` helps LLMs understand and navigate site content. |

### API Documentation (for implementation)

| Platform           | API Docs                         | Notes                           |
| ------------------ | -------------------------------- | ------------------------------- |
| OpenAI (ChatGPT)   | https://platform.openai.com/docs | Well-documented, primary target |
| Perplexity         | https://docs.perplexity.ai       | Sonar API for search            |
| Google Gemini      | https://ai.google.dev/docs       | Gemini API                      |
| Anthropic (Claude) | https://docs.anthropic.com       | Claude API                      |

### Implementation Framework

| Tool          | URL                        | Notes                                                                                |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| Vercel AI SDK | https://sdk.vercel.ai/docs | Unified interface for multiple AI providers. Will use this for all AI functionality. |

---

## How AI Visibility Tools Work

### Core Methodology

1. **Prompt submission:** Submit industry-relevant prompts to LLMs programmatically
2. **Response parsing:** Analyze AI responses to extract brand mentions and citations
3. **Tracking over time:** Store results to show trends and changes
4. **Competitive benchmarking:** Compare visibility against competitors

### What to Track

| Metric                  | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| **Brand Mentions**      | When and how your brand is referenced in AI responses        |
| **Share of Voice**      | How often mentioned vs competitors (1st position = 100% SOV) |
| **AI Visibility Score** | Mentions compared to industry median                         |
| **Sentiment**           | Positive/negative/neutral tone when mentioned                |
| **Citation Sources**    | Which websites AI platforms cite as authority                |
| **Position**            | Where brand appears in the response (1st, 2nd, etc.)         |
| **Full Response Text**  | Complete AI answers for detailed analysis                    |

### Key Findings from SemRush Research

- ChatGPT and Google AI Mode agree **67%** on which brands to mention
- They agree only **30%** on which sources to cite
- Reddit accounts for 46.7% of Perplexity citations but only 11.3% of ChatGPT citations
- Fewer than 1 in 5 brands are both frequently mentioned AND cited as authoritative sources

---

## Technical Strategies

### Approach 1: Direct API Integration

Query each LLM's API directly with industry-relevant prompts.

**Pros:**

- Full control over prompts and parsing
- Real-time data
- Can customize for specific use cases

**Cons:**

- API costs scale with usage
- Need to maintain integrations for multiple platforms
- Rate limits to manage

**Stack:**

- OpenAI API (ChatGPT/GPT-4)
- Perplexity Sonar API
- Google Gemini API
- Background job queue (e.g., BullMQ, Inngest) for scheduled monitoring

### Approach 2: Headless Browser Automation

Use Playwright/Puppeteer to simulate user interactions with AI chat interfaces.

**Pros:**

- Access to platforms without official APIs
- See exactly what users see

**Cons:**

- Fragile (UI changes break automation)
- ToS concerns
- Slower and more resource-intensive

### Approach 3: Hybrid

Use APIs where available, fall back to automation for platforms without APIs.

---

## Feature: AI Visibility Monitoring

Track how your brand appears in AI responses over time. See improvements as you optimize your AI presence.

### Setup

1. **Brand configuration**
   - Your brand name (and variations/aliases)
   - Competitor brands to benchmark against
   - Industry/category

2. **Prompt library**
   - User defines prompts relevant to their industry
   - Or selects from templates (e.g., "best [industry] software", "top [service] providers")
   - Prompts should reflect what potential customers actually ask AI

3. **Platforms to track**
   - ChatGPT (GPT-4)
   - Perplexity
   - Google Gemini
   - Claude (if API allows)

### How It Works

**Scheduled monitoring:**

1. System runs each prompt against each platform (daily/weekly)
2. Parses responses to extract:
   - Was your brand mentioned? (yes/no)
   - Position in response (1st, 2nd, 3rd, not mentioned)
   - Sentiment (positive/neutral/negative)
   - Context/quote around the mention
   - Sources cited
   - Competitor mentions
3. Stores results for historical tracking
4. Calculates aggregate metrics

### Dashboard View

**Overview cards:**

- AI Visibility Score (0-100, trend arrow)
- Share of Voice vs competitors (pie chart)
- Mentions this period vs last (trend)

**Prompt performance table:**
| Prompt | ChatGPT | Perplexity | Gemini | Trend |
|--------|---------|------------|--------|-------|
| "best CRM for startups" | 1st | 2nd | - | ↑ |
| "top marketing tools" | 3rd | 1st | 2nd | → |
| "affordable project management" | - | - | - | ↓ |

**Historical chart:**

- Line graph showing visibility score over time
- Overlay competitor scores for comparison
- Annotations for key events (e.g., "Published llms.txt")

### Alerts

Notify when:

- Visibility score drops significantly
- Competitor overtakes you on key prompts
- New competitor appears in responses
- Sentiment shifts negative

### Data Model

```
prompt_tracking_configs
- id
- organization_id
- brand_name
- brand_aliases[]
- competitors[]
- created_at

tracked_prompts
- id
- config_id
- prompt_text
- category (optional)
- is_active
- created_at

prompt_results
- id
- prompt_id
- platform (chatgpt, perplexity, gemini, claude)
- run_date
- full_response (text)
- brand_mentioned (boolean)
- mention_position (1, 2, 3, null)
- mention_context (extracted quote)
- sentiment (positive, neutral, negative)
- citations[] (URLs)
- competitor_mentions[] (jsonb: [{name, position}])
- created_at

visibility_metrics_daily
- id
- organization_id
- date
- platform
- visibility_score
- share_of_voice
- mention_count
- avg_position
- avg_sentiment
```

### Research Mode (Phase 2)

On-demand exploration for ad-hoc queries:

- User enters any prompt
- See how AI responds in real-time across platforms
- Compare responses side-by-side
- Option to add prompt to ongoing monitoring

---

## UX Reference: Otterly (Baseline)

> Source: https://www.semrush.com/kb/1487-otterly-ai-search-monitoring

Using Otterly's UX as a baseline for our AI Visibility Monitoring feature.

### Onboarding Flow

1. First launch prompts user to "add a new search prompt"
2. User enters search term (product name, question, industry query)
3. Clicks "Add Search Prompt" to generate analysis
4. Initial report generation takes up to 5 minutes
5. Loading state while AI platforms are queried

### Main Dashboard

| Element             | Location  | Description                            |
| ------------------- | --------- | -------------------------------------- |
| Search prompts list | Center    | Blue text links to each tracked prompt |
| Total prompts count | Top-left  | Shows available/used prompts           |
| Add prompts button  | Top-right | Purchase more prompts                  |
| Delete icon         | Per row   | Trash icon to remove prompts           |

### Report View (Per Prompt)

Each prompt expands to show results across platforms (Google AI Overviews, ChatGPT, Perplexity):

**1. Text Output**

- Exact text generated by each AI platform
- Expandable "More"/"Less" toggle for long responses
- Side-by-side comparison across platforms

**2. Link Tracking**

- All URLs referenced in AI responses
- Ranked by appearance order
- Clickable for deeper analysis

**3. AI Brand Ranking**

- Positions showing how AI perceives competitors
- Updated weekly
- Visual ranking display

**4. Snapshot**

- Visual screenshot captures of actual AI responses
- Expandable via click or arrows
- Proof of what users would see

**5. Weekly Link Tracking**

- Week-by-week comparison
- Line graphs showing position changes over time
- Checkbox toggles to show/hide specific links

**6. Sentiment Analysis**

- Color-coded bar chart (green/gray/red for positive/neutral/negative)
- Hover reveals bullet points explaining sentiment
- Per-brand breakdown

### Navigation

| Element            | Function                             |
| ------------------ | ------------------------------------ |
| "Last Update" menu | Browse historical weekly reports     |
| Next update timing | Shows when data refreshes            |
| Empty state        | "Not available" notices when no data |

### Selo Adaptations

Based on Otterly's UX, for Selo we should:

1. **Simplify onboarding** - Prompt setup wizard with industry templates
2. **Dashboard integration** - AI visibility as a section alongside existing integrations
3. **Platform columns** - Show ChatGPT, Perplexity, Gemini side-by-side
4. **Historical comparison** - Week-over-week trends with visual charts
5. **Actionable insights** - Link sentiment to Site Audit recommendations

---

## Industry Context: llms.txt

A proposed standard (`/llms.txt`) helps websites become more visible to LLMs:

- Markdown file at website root
- Provides curated, LLM-friendly summary of site content
- Helps LLMs find essential info without parsing cluttered HTML
- Complementary `.md` versions of important pages

**Relevance to Selo:** Could add a feature that audits whether a user's website has `llms.txt` and helps them create one.

---

## Market Opportunity

- AI-referred sessions jumped **527%** between Jan-May 2025
- Some SaaS companies see **>1%** of total traffic from LLMs
- Visitors from LLMs convert **4.4x better** than traditional organic search
- This is a rapidly emerging channel that most marketing teams don't yet track

---

## Feature: AI-Ready Site Audit

A tool where users provide their website URL, and Selo crawls it to assess SEO and AI compliance, providing a score and actionable recommendations.

### What to Check

| Check                     | Description                                         | Weight |
| ------------------------- | --------------------------------------------------- | ------ |
| **llms.txt**              | Does `/llms.txt` exist? Is it well-structured?      | High   |
| **Markdown alternatives** | Are `.md` versions of key pages available?          | Medium |
| **Structured data**       | Schema.org markup (JSON-LD) for rich context        | High   |
| **Meta descriptions**     | Present and descriptive for all pages               | Medium |
| **Heading structure**     | Proper H1/H2/H3 hierarchy for content parsing       | Medium |
| **Content clarity**       | Readable, well-organized content (not hidden in JS) | High   |
| **Canonical URLs**        | Proper canonicalization to avoid duplicate content  | Medium |
| **robots.txt**            | Allows AI crawlers (GPTBot, PerplexityBot, etc.)    | High   |
| **Sitemap**               | XML sitemap exists and is accessible                | Medium |
| **Page speed**            | Fast-loading pages (affects crawlability)           | Low    |
| **Mobile-friendly**       | Responsive design                                   | Low    |

### AI Crawler Robots.txt Checks

Modern AI crawlers to check for:

- `GPTBot` (OpenAI)
- `ChatGPT-User` (ChatGPT browsing)
- `PerplexityBot` (Perplexity)
- `Google-Extended` (Gemini/Bard training)
- `Anthropic-AI` (Claude)
- `ClaudeBot` (Claude web access)

### Output

1. **Overall Score** (0-100) with grade (A/B/C/D/F)
2. **Category breakdown** (SEO basics, AI-readiness, Technical)
3. **Action items** prioritized by impact - with **Generate** buttons where applicable
4. **Comparison** to industry benchmarks (if available)

### Generative Fixes

For missing files, provide a "Generate" button that creates the file for download.

| Missing Item             | Generate Action                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **llms.txt**             | Crawl site, extract key pages/sections, generate markdown summary following llms.txt spec |
| **robots.txt additions** | Generate AI-friendly rules to append (allow GPTBot, PerplexityBot, etc.)                  |
| **Structured data**      | Generate JSON-LD snippets for Organization, WebSite, Article schemas                      |
| **Meta descriptions**    | Use LLM to generate suggested meta descriptions for pages missing them                    |

**Workflow:**

1. Audit finds missing `llms.txt`
2. Report shows: "llms.txt not found" with **Generate** button
3. User clicks Generate
4. System crawls site, identifies key pages (homepage, about, products, docs)
5. LLM generates llms.txt content following the spec
6. User previews and downloads the file
7. User uploads to their website root

**Technical considerations:**

- Use LLM (Claude/GPT) to summarize site content into llms.txt format
- Cache crawl results to avoid re-crawling for each generation
- Allow user to edit generated content before download

---

## Feature: Prospect Audit Tool (Lead Generation)

An internal, auth-required tool for auditing potential clients' websites as part of the sales process.

### Use Case

1. Selo user (sales/marketing) identifies potential client
2. Paste prospect's website URL into the audit tool
3. Generate professional report with scores and recommendations
4. Send report to prospect with pricing for implementation services
5. Prospect sees value, becomes paying client

### How It Works

**Internal page:** `/audit` (auth required)

**Flow:**

1. Logged-in user enters any website URL
2. System crawls and audits the site
3. Generates branded PDF/web report
4. Options:
   - Download report
   - Email report to prospect (Selo-branded)
   - Share via unique link (recipient doesn't need login)

### Report Contents

1. **Executive Summary** - Overall AI-readiness score, key findings
2. **Detailed Breakdown** - Each check with pass/fail and explanation
3. **Recommendations** - Prioritized action items
4. **Pricing Table** - Cost to implement each fix (configurable)
5. **Call to Action** - Contact info, next steps

### Pricing Configuration

Allow Selo users to configure their service pricing:

| Fix                            | Default Price | Customizable |
| ------------------------------ | ------------- | ------------ |
| Generate & implement llms.txt  | $200          | Yes          |
| Structured data implementation | $500          | Yes          |
| robots.txt AI optimization     | $100          | Yes          |
| Full AI-readiness package      | $1,500        | Yes          |

Prices appear in the generated report.

### Lead Tracking

Store audit requests for follow-up:

```
audit_leads
- id
- organization_id (who ran the audit)
- prospect_url
- prospect_email (if provided)
- report_id
- score
- status (new, contacted, converted, lost)
- created_at
```

---

### Integration with Onboarding (Your Own Site Audit)

**Database change:** Add `website_url` column to `organizations` table.

**Onboarding flow:**

1. User creates organization (name + website URL)
2. System automatically triggers initial site audit
3. Dashboard shows AI-readiness score alongside other metrics

**Ongoing:**

- Re-run audit periodically (weekly?) or on-demand
- Track score changes over time
- Alert when score drops significantly

### Technical Approach

- Use headless browser (Playwright) or HTTP client to fetch pages
- Parse HTML for meta tags, structured data, heading structure
- Check for `/llms.txt`, `/robots.txt`, `/sitemap.xml`
- Analyze content quality (text-to-HTML ratio, readability)
- Generate report with scores and recommendations
- Store results in `site_audit_results` table for historical tracking

---

## Open Questions

- [ ] Which AI platforms to prioritize first? (ChatGPT + Perplexity seem most valuable)
- [ ] How to handle API costs at scale?
- [ ] What prompt templates make sense for different industries?
- [ ] How frequently should monitoring run?
- [ ] Should we offer llms.txt generation/auditing as a related feature?

---

## Resources to Review

_Add links here as research continues:_

-
-
- ***

## Next Steps

1. Research API pricing for OpenAI, Perplexity, Gemini
2. Build proof-of-concept: single prompt → multiple platforms → parse mentions
3. Design dashboard UI for AI visibility section
4. Define MVP scope (which metrics, which platforms)
