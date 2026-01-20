# Site Audit Expansion Research

> Research findings for expanding our SEO/AIO audit with industry best practices from Google, Bing, OpenAI, Anthropic, and other authoritative sources.

## Sources

### AI Readiness

- [OpenAI Crawlers Overview](https://platform.openai.com/docs/bots)
- [GPTBot Documentation](https://platform.openai.com/docs/gptbot)
- [Best Practices for AI-Oriented robots.txt and llms.txt](https://medium.com/@franciscokemeny/best-practices-for-ai-oriented-robots-txt-and-llms-txt-configuration-be564ba5a6bd)
- [LLMs.txt Explained](https://medium.com/data-science/llms-txt-explained-414d5121bcb3)
- [LLMs.txt: The Emerging Standard](https://scalemath.com/blog/llms-txt/)
- [What is LLMs.txt? Make Your Website AI-Ready](https://www.tngshopper.com/post/what-is-llms-txt-make-your-website-ai-ready)

### SEO & Technical

- [Google Core Web Vitals Documentation](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Google Search Console Core Web Vitals Report](https://support.google.com/webmasters/answer/9205520)
- [Backlinko 18-Step SEO Audit Checklist](https://backlinko.com/seo-site-audit)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [Bing Structured Data Documentation](https://www.bing.com/webmasters/help/marking-up-your-site-with-structured-data-3a93e731)
- [Core Web Vitals 2026 Guide](https://senorit.de/en/blog/core-web-vitals-2026)

---

## Key Findings

### 1. AI Crawler Behavior

**OpenAI's GPTBot:**

- Cannot render JavaScript - only sees initial HTML
- Imposes tight timeouts (1-5 seconds)
- Respects robots.txt (updates honored within 24 hours)
- Prefers clean, well-structured HTML
- Crawl frequency is infrequent compared to Googlebot

**Anthropic's ClaudeBot:**

- Web crawler for training data collection
- Similar limitations to GPTBot regarding JS rendering

**Key Insight:** Sites relying heavily on client-side rendering may be invisible to AI systems.

### 2. llms.txt Standard

- Proposed by Jeremy Howard (Answer.AI co-founder)
- Solves context window limitations for AI systems
- Two files: `/llms.txt` (navigation) and `/llms-full.txt` (comprehensive)
- Adopted by Anthropic, Cursor, and thousands of Mintlify-hosted docs
- While not officially supported by major LLM providers, crawlers are actively indexing these files

### 3. Core Web Vitals (2026 Thresholds)

| Metric                          | Good   | Needs Improvement | Poor   |
| ------------------------------- | ------ | ----------------- | ------ |
| LCP (Largest Contentful Paint)  | ≤2.5s  | 2.5s-4s           | >4s    |
| INP (Interaction to Next Paint) | ≤200ms | 200ms-500ms       | >500ms |
| CLS (Cumulative Layout Shift)   | ≤0.1   | 0.1-0.25          | >0.25  |

**Note:** FID was replaced by INP in March 2024.

### 4. Bing-Specific Considerations

- Places more weight on exact-match keywords
- Still uses desktop-first indexing (unlike Google's mobile-first)
- Explicitly acknowledges social media signals as ranking factor
- Uses meta descriptions for relevance assessment
- Prefers pages reachable within 3 clicks from homepage

---

## Proposed New Checks

### SEO Checks (High Priority)

| Check                    | Priority    | Status | Description                            |
| ------------------------ | ----------- | ------ | -------------------------------------- |
| `core_web_vitals_lcp`    | Critical    | NEW    | LCP should be under 2.5 seconds        |
| `core_web_vitals_cls`    | Critical    | NEW    | CLS should be under 0.1                |
| `missing_canonical`      | Critical    | EXISTS | Canonical tag for duplicate prevention |
| `missing_sitemap`        | Critical    | NEW    | XML sitemap at /sitemap.xml            |
| `broken_internal_links`  | Critical    | NEW    | Check for 404 internal links           |
| `duplicate_titles`       | Recommended | NEW    | Same title tag across multiple pages   |
| `duplicate_descriptions` | Recommended | NEW    | Same meta description across pages     |
| `missing_open_graph`     | Recommended | NEW    | og:title, og:description, og:image     |
| `missing_twitter_cards`  | Recommended | NEW    | twitter:card, twitter:title, etc.      |
| `thin_content`           | Recommended | EXISTS | Pages with minimal text content        |
| `missing_hreflang`       | Optional    | NEW    | For international/multilingual sites   |
| `deep_page_depth`        | Recommended | NEW    | Pages more than 3 clicks from home     |
| `redirect_chains`        | Recommended | NEW    | Multiple redirects in sequence         |
| `image_optimization`     | Recommended | NEW    | WebP/AVIF format, proper sizing        |

### AI Readiness Checks (High Priority)

| Check                         | Priority    | Status | Description                             |
| ----------------------------- | ----------- | ------ | --------------------------------------- |
| `missing_llms_txt`            | Critical    | EXISTS | /llms.txt file for AI context           |
| `missing_llms_full_txt`       | Recommended | NEW    | /llms-full.txt comprehensive file       |
| `robots_blocks_ai`            | Critical    | NEW    | Check if GPTBot/ClaudeBot blocked       |
| `js_rendered_content`         | Critical    | NEW    | Content only visible after JS execution |
| `slow_response_time`          | Critical    | NEW    | Response time >5s (AI crawler timeout)  |
| `missing_structured_data`     | Critical    | EXISTS | JSON-LD structured data                 |
| `no_faq_content`              | Recommended | EXISTS | FAQ schema for AI assistants            |
| `missing_speakable`           | Optional    | NEW    | Speakable schema for voice search       |
| `missing_organization_schema` | Recommended | NEW    | Organization JSON-LD on homepage        |
| `missing_breadcrumb_schema`   | Recommended | NEW    | BreadcrumbList for navigation           |

### Technical Checks (Medium Priority)

| Check                       | Priority    | Status | Description                   |
| --------------------------- | ----------- | ------ | ----------------------------- |
| `missing_ssl`               | Critical    | EXISTS | HTTPS encryption              |
| `missing_viewport`          | Recommended | EXISTS | Mobile viewport meta tag      |
| `mixed_content`             | Critical    | NEW    | HTTP resources on HTTPS pages |
| `missing_compression`       | Recommended | NEW    | Gzip/Brotli compression       |
| `missing_cache_headers`     | Recommended | NEW    | Browser caching headers       |
| `missing_security_headers`  | Optional    | NEW    | CSP, X-Frame-Options, etc.    |
| `slow_server_response`      | Critical    | NEW    | TTFB >600ms                   |
| `unminified_resources`      | Optional    | NEW    | CSS/JS not minified           |
| `render_blocking_resources` | Recommended | NEW    | CSS/JS blocking first paint   |

---

## Implementation Priority

### Phase 1: Critical Checks (Immediate)

1. `robots_blocks_ai` - Check robots.txt for AI crawler access
2. `missing_llms_full_txt` - Full llms.txt file
3. `js_rendered_content` - Detect JS-only content
4. `slow_response_time` - Page load time for AI crawlers
5. `missing_sitemap` - XML sitemap presence
6. `broken_internal_links` - 404 detection

### Phase 2: Core Web Vitals

1. Integrate with PageSpeed Insights API or Lighthouse
2. `core_web_vitals_lcp` - LCP measurement
3. `core_web_vitals_cls` - CLS measurement
4. `core_web_vitals_inp` - INP measurement (requires real user data)

### Phase 3: Enhanced SEO

1. `missing_open_graph` - Social sharing optimization
2. `missing_twitter_cards` - Twitter sharing
3. `duplicate_titles` - Cross-page analysis
4. `duplicate_descriptions` - Cross-page analysis
5. `deep_page_depth` - Navigation depth analysis
6. `missing_organization_schema` - Business identity

### Phase 4: Advanced Technical

1. `mixed_content` - Security audit
2. `missing_security_headers` - Header analysis
3. `render_blocking_resources` - Performance optimization
4. `missing_compression` - Transfer optimization

---

## AI-Powered Enhancement Opportunities

### 1. Content Quality Analysis

Use AI to analyze:

- Readability and clarity of content
- Keyword density and natural language usage
- Content freshness indicators
- Duplicate/plagiarized content detection

### 2. Competitive Analysis

- Compare client's site against competitors
- Identify missing schema types competitors use
- Benchmark Core Web Vitals against industry

### 3. Actionable Recommendations

Generate specific, prioritized recommendations:

- Code snippets for missing schema
- Exact meta tag improvements
- Image optimization suggestions with file names

### 4. Executive Summary Enhancement

- Industry-specific insights
- ROI impact estimation
- Priority matrix based on effort vs. impact

---

## Report Enhancement Ideas

### For Developers

- Exact code snippets to implement fixes
- File paths where changes are needed
- Before/after examples
- Links to relevant documentation

### For Stakeholders

- Visual score comparisons
- Trend analysis over time
- Competitive benchmarking
- Business impact statements

### Export Formats

- PDF executive summary
- CSV for data analysis
- JSON for API integration
- HTML for sharing

---

## Future Optimizations

### Sitemap-First Crawling

**Problem:** Current BFS link-discovery crawling can be slow for large sites and may miss pages that aren't well-linked from the homepage.

**Proposed Solution:** Fetch and parse the sitemap first, then use those URLs as the page list.

**Benefits:**

- Much faster route discovery (single HTTP request vs. crawl link-by-link)
- More complete coverage (sitemap lists what the site owner wants indexed)
- Smarter sampling using `<priority>` and `<lastmod>` metadata
- No missed deep pages that aren't linked from homepage

**Challenges to Address:**
| Challenge | Possible Solution |
|-----------|-------------------|
| No sitemap exists | Fall back to current crawl approach |
| Sitemap has 10,000+ URLs | Sample intelligently by priority, recency, and URL variety |
| Sitemap index files | Parse index, fetch child sitemaps, combine |
| Stale sitemap | Cross-reference with quick homepage crawl |
| Junk pages (archives, tags) | Filter by URL patterns or limit per "type" |

**Implementation Approach:**

1. Try to fetch sitemap first (already checking in `missing_sitemap`)
2. If sitemap exists: parse URLs, apply sampling strategy
3. If no sitemap: fall back to current BFS crawl
4. Optionally: hybrid approach (sitemap + quick homepage crawl for nav links)

**Sampling Strategy Considerations:**

- Prioritize by `<priority>` value if present
- Include most recently modified pages (`<lastmod>`)
- Ensure variety across URL patterns (home, blog, products, about, etc.)
- Let users choose audit depth: "quick" (10 pages) vs "deep" (100+ pages)
