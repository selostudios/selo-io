# AI Audit Instructions

> This document provides structured instructions for AI-powered analysis during site audits. Use these guidelines to evaluate websites against industry best practices from Google, Bing, OpenAI, and Anthropic.

---

## Output Format Specification

**CRITICAL:** All AI-generated checks MUST return data in this exact format to integrate with the audit UI:

```typescript
interface AICheckResult {
  check_name: string // Unique identifier, snake_case (e.g., "content_quality_score")
  check_type: 'seo' | 'ai_readiness' | 'technical'
  priority: 'critical' | 'recommended' | 'optional'
  status: 'passed' | 'failed' | 'warning'
  details: {
    message: string // Human-readable explanation (shown in UI)
    // Additional context fields as needed:
    count?: number
    examples?: string[]
    suggestion?: string
    code_snippet?: string
  }
  display_name: string // Name shown when failed/warning (e.g., "Poor Content Quality")
  display_name_passed?: string // Name shown when passed (e.g., "Content Quality")
  learn_more_url?: string // External documentation link
  is_site_wide?: boolean // true = show once in Site-wide section
}
```

### Example Output

```json
{
  "check_name": "content_readability",
  "check_type": "seo",
  "priority": "recommended",
  "status": "warning",
  "details": {
    "message": "Content readability is at a college level. Consider simplifying for broader audience reach. Current Flesch-Kincaid grade: 14.2",
    "suggestion": "Break up long sentences, use simpler vocabulary, and add more subheadings."
  },
  "display_name": "Complex Content",
  "display_name_passed": "Readable Content",
  "learn_more_url": "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
  "is_site_wide": false
}
```

---

## Executive Summary Generation

Generate an executive summary using this template and context:

### Input Context

```
Site URL: {url}
Pages Crawled: {pages_crawled}
Overall Score: {overall_score}/100
SEO Score: {seo_score}/100
AI-Readiness Score: {ai_readiness_score}/100
Technical Score: {technical_score}/100

Failed Checks (Critical):
{list of critical failed checks with details}

Failed Checks (Recommended):
{list of recommended failed checks with details}

Warning Checks:
{list of warning checks with details}

Passed Checks:
{count of passed checks by category}
```

### Executive Summary Requirements

Generate a 3-4 paragraph summary that includes:

**Paragraph 1 - Overall Assessment:**

- Site health score interpretation (Poor: <50, Needs Work: 50-70, Good: 70-85, Excellent: 85+)
- Number of pages analyzed
- Brief statement on the site's primary strengths

**Paragraph 2 - Priority Issues:**

- Top 3 critical issues that need immediate attention
- Why these issues matter (business impact)
- Be specific about what's wrong, not just the check name

**Paragraph 3 - Quick Wins:**

- 2-3 easy fixes that would improve the score
- Estimated impact of each fix
- Focus on low-effort, high-impact changes

**Paragraph 4 - Next Steps:**

- Recommended order of fixes
- Encouraging statement about potential improvement
- Mention any positive findings to balance the report

### Tone Guidelines

- Professional but accessible (avoid jargon)
- Actionable (focus on what to do, not just what's wrong)
- Balanced (acknowledge strengths alongside weaknesses)
- Concise (aim for 200-300 words total)
- No markdown formatting (plain text only)

### Example Executive Summary

```
Your website scored 72 out of 100, indicating good foundational SEO with room for improvement. Our audit analyzed 45 pages and found that your site has strong technical fundamentals—HTTPS is properly configured, pages load quickly, and your content is well-structured with proper heading hierarchy.

However, three critical issues require immediate attention. First, 12 pages are missing meta descriptions, which means search engines will auto-generate snippets that may not effectively represent your content. Second, your site lacks an llms.txt file, making it harder for AI assistants like ChatGPT and Claude to accurately understand and recommend your services. Third, several images are missing alt text, impacting both accessibility and image search visibility.

For quick wins, consider adding meta descriptions to your top 5 traffic pages first—this typically takes just 10-15 minutes per page and can improve click-through rates by 5-10%. Creating a basic llms.txt file is another 30-minute task that positions your site for the growing AI search landscape.

We recommend addressing the meta description gaps first, followed by the llms.txt implementation, then the image alt text issues. With these improvements, your score could reach 85+ within a few weeks. Your site already has a solid foundation—these targeted fixes will help you compete more effectively in both traditional and AI-powered search.
```

---

## 1. SEO Analysis Instructions

### 1.1 Title Tag Analysis

**Check:** Evaluate the `<title>` tag on each page.

**Pass Criteria:**

- Title exists and is not empty
- Length is 50-60 characters (optimal for SERP display)
- Contains primary keyword near the beginning
- Is unique across the site (no duplicates)
- Accurately describes page content

**Fail Criteria:**

- Missing title tag
- Empty title tag
- Title over 60 characters (will be truncated in search results)

**Warning Criteria:**

- Title under 30 characters (may be too short)
- Title is generic (e.g., "Home", "Welcome", "Untitled")
- Duplicate title found on another page

**Recommendation Format:**

```
Current: "[current title]"
Issue: [specific issue]
Suggested: "[improved title under 60 chars with keyword]"
```

---

### 1.2 Meta Description Analysis

**Check:** Evaluate the `<meta name="description">` tag.

**Pass Criteria:**

- Description exists and is not empty
- Length is 150-160 characters
- Contains call-to-action or value proposition
- Is unique across the site
- Includes relevant keywords naturally

**Fail Criteria:**

- Missing meta description
- Empty meta description

**Warning Criteria:**

- Description over 160 characters
- Description under 70 characters
- Duplicate description on another page
- Description doesn't match page content

**Recommendation Format:**

```
Current: "[current description or 'Missing']"
Issue: [specific issue]
Suggested: "[compelling description under 160 chars]"
```

---

### 1.3 Heading Structure Analysis

**Check:** Evaluate the heading hierarchy (H1-H6).

**Pass Criteria:**

- Exactly one H1 per page
- H1 contains primary keyword
- Headings follow logical hierarchy (no skipping levels)
- Headings describe section content

**Fail Criteria:**

- Missing H1 tag
- Multiple H1 tags on the same page

**Warning Criteria:**

- H1 doesn't contain target keyword
- Skipped heading levels (e.g., H1 → H3)
- Empty heading tags
- Very long headings (over 70 characters)

**Recommendation Format:**

```
Current H1: "[current H1 or 'Missing']"
Issue: [specific issue]
Suggested H1: "[improved H1 with keyword]"
Heading hierarchy issues: [list any hierarchy problems]
```

---

### 1.4 Image Optimization Analysis

**Check:** Evaluate all `<img>` tags on the page.

**Pass Criteria:**

- All images have descriptive alt text
- Alt text describes image content (not just "image" or filename)
- Images use modern formats (WebP, AVIF) where supported
- Images have explicit width and height attributes (prevents CLS)
- Images are appropriately sized (not scaled down via CSS)

**Fail Criteria:**

- Images missing alt attribute entirely
- Decorative images missing alt="" (empty alt for screen readers)

**Warning Criteria:**

- Alt text is generic ("image", "photo", "pic")
- Alt text is the filename
- Large images (over 500KB)
- Images without width/height causing layout shift
- Using PNG/JPG when WebP would be better

**Recommendation Format:**

```
Images analyzed: [count]
Missing alt text: [count] images
- [src]: Suggested alt: "[descriptive alt text]"
Large images needing optimization: [count]
- [src]: Current [size], recommend compression
```

---

### 1.5 Internal Linking Analysis

**Check:** Evaluate internal link structure.

**Pass Criteria:**

- All internal links resolve (no 404s)
- Important pages are within 3 clicks from homepage
- Anchor text is descriptive (not "click here")
- No orphan pages (pages with no internal links pointing to them)

**Fail Criteria:**

- Broken internal links (404 errors)
- Pages unreachable from navigation

**Warning Criteria:**

- Pages more than 3 clicks deep
- Generic anchor text ("click here", "read more", "learn more")
- Too many links on one page (over 100)
- Orphan pages with no internal links

**Recommendation Format:**

```
Total internal links: [count]
Broken links found: [count]
- [broken URL] linked from [source page]
Deep pages (>3 clicks): [count]
- [URL]: [click depth] clicks from homepage
Suggested improvements:
- Add internal link to [page] from [relevant page]
```

---

## 2. AI Readiness Analysis Instructions

### 2.1 robots.txt AI Crawler Analysis

**Check:** Evaluate robots.txt for AI crawler access.

**AI Crawlers to Check:**

- `GPTBot` (OpenAI training)
- `OAI-SearchBot` (OpenAI search)
- `ChatGPT-User` (ChatGPT live queries)
- `ClaudeBot` (Anthropic)
- `Claude-Web` (Anthropic)
- `Google-Extended` (Google AI)
- `Bytespider` (ByteDance)
- `PerplexityBot` (Perplexity)

**Pass Criteria:**

- robots.txt exists and is accessible
- AI crawlers are explicitly allowed OR not mentioned (default allow)
- Sitemap is referenced in robots.txt

**Fail Criteria:**

- robots.txt blocks all AI crawlers with `Disallow: /`
- Critical AI crawlers (GPTBot, ClaudeBot) are blocked

**Warning Criteria:**

- Some AI crawlers blocked, others allowed (inconsistent policy)
- No sitemap reference in robots.txt
- Overly restrictive rules that may block AI crawlers unintentionally

**Recommendation Format:**

```
AI Crawler Access Summary:
- GPTBot: [Allowed/Blocked/Not specified]
- ClaudeBot: [Allowed/Blocked/Not specified]
- Google-Extended: [Allowed/Blocked/Not specified]

Current robots.txt issues:
- [specific issue]

Suggested robots.txt additions:
```

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

```

```

---

### 2.2 llms.txt Analysis

**Check:** Evaluate presence and quality of llms.txt files.

**Files to Check:**

- `/llms.txt` - Navigation/overview file
- `/llms-full.txt` - Comprehensive documentation

**Pass Criteria:**

- `/llms.txt` exists and is accessible
- File starts with H1 (# Project Name)
- Contains blockquote summary
- Lists key pages/documentation with descriptions

**Fail Criteria:**

- `/llms.txt` does not exist

**Warning Criteria:**

- File exists but is empty or malformed
- Missing `/llms-full.txt` companion file
- Content is outdated or incomplete
- File is too large (over 100KB may hit context limits)

**Recommendation Format:**

````
llms.txt Status: [Present/Missing]
llms-full.txt Status: [Present/Missing]

If missing, create /llms.txt with this structure:
```markdown
# [Company/Product Name]

> [One sentence description of what this site/product does]

## Documentation
- [Page Title](/path): Brief description
- [Page Title](/path): Brief description

## Key Features
- Feature 1: Description
- Feature 2: Description

## Contact
- Website: [URL]
- Support: [email or URL]
````

```

---

### 2.3 Structured Data Analysis

**Check:** Evaluate JSON-LD structured data on each page.

**Schema Types to Look For:**
- `Organization` - Company information (homepage)
- `WebSite` - Site-wide information with search
- `BreadcrumbList` - Navigation breadcrumbs
- `Article` / `BlogPosting` - Blog/news content
- `Product` - E-commerce products
- `FAQPage` - FAQ sections
- `LocalBusiness` - Physical business locations
- `Service` - Service offerings
- `HowTo` - Tutorial content
- `VideoObject` - Video content
- `Speakable` - Voice search optimization

**Pass Criteria:**
- At least one valid JSON-LD script on the page
- Schema type matches page content
- Required properties are present for the schema type
- No JSON syntax errors

**Fail Criteria:**
- No structured data on the page
- JSON-LD has syntax errors
- Schema type doesn't match content (misleading)

**Warning Criteria:**
- Missing recommended properties
- Using deprecated schema properties
- Homepage missing Organization schema
- FAQ content without FAQPage schema
- Product pages without Product schema

**Recommendation Format:**
```

Structured Data Found: [list schema types]
Missing Recommended Schema:

- This page should have [Schema Type] because [reason]

Suggested JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "[Type]",
  "name": "[value]",
  ...
}
```

```

---

### 2.4 Content Accessibility for AI

**Check:** Evaluate if content is accessible to AI crawlers.

**Pass Criteria:**
- Main content is in initial HTML (server-rendered)
- Text content is not embedded in images
- Content is not behind login/paywall
- Page loads within 5 seconds

**Fail Criteria:**
- Page requires JavaScript to display any content
- All content is rendered client-side only
- Page takes over 5 seconds to respond

**Warning Criteria:**
- Significant content requires JavaScript
- Important text is in images without alt text
- Content is lazy-loaded below the fold
- Heavy reliance on iframes for content

**Analysis Method:**
Compare content visible in:
1. Raw HTML response (what AI crawlers see)
2. Fully rendered page (what users see)

**Recommendation Format:**
```

Server-rendered content: [percentage or assessment]
JavaScript-dependent content: [list what's missing in raw HTML]

Issues:

- [Content type] only appears after JavaScript execution
- AI crawlers will not see: [specific content]

Recommendations:

- Implement server-side rendering for [content]
- Add static HTML fallback for [content]

```

---

## 3. Technical Analysis Instructions

### 3.1 Page Speed Analysis

**Check:** Evaluate page load performance.

**Metrics to Assess:**
- Time to First Byte (TTFB): Should be <600ms
- First Contentful Paint (FCP): Should be <1.8s
- Largest Contentful Paint (LCP): Should be <2.5s
- Total page size: Should be <3MB
- Number of requests: Should be <50

**Pass Criteria:**
- LCP under 2.5 seconds
- TTFB under 600ms
- Page size under 3MB

**Fail Criteria:**
- LCP over 4 seconds
- TTFB over 1.5 seconds
- Page size over 10MB

**Warning Criteria:**
- LCP between 2.5-4 seconds
- TTFB between 600ms-1.5s
- Page size between 3-10MB
- Over 100 HTTP requests

**Recommendation Format:**
```

Performance Metrics:

- TTFB: [value] ([Good/Needs Improvement/Poor])
- LCP: [value] ([Good/Needs Improvement/Poor])
- Page Size: [value]
- Requests: [count]

Top Performance Issues:

1. [Issue]: [Impact and fix]
2. [Issue]: [Impact and fix]

Quick Wins:

- Compress images: Save ~[X]KB
- Enable caching: [specific headers]
- Minify CSS/JS: Save ~[X]KB

```

---

### 3.2 Mobile Friendliness Analysis

**Check:** Evaluate mobile usability.

**Pass Criteria:**
- Viewport meta tag present and correct
- Text readable without zooming (16px+ base font)
- Tap targets adequately sized (48x48px minimum)
- No horizontal scrolling required
- Content fits viewport width

**Fail Criteria:**
- Missing viewport meta tag
- Page not responsive (fixed width)
- Text too small to read on mobile

**Warning Criteria:**
- Tap targets too close together
- Content wider than viewport
- Font size under 14px on mobile
- Intrusive interstitials

**Recommendation Format:**
```

Mobile Friendliness: [Pass/Fail]

Issues Found:

- [Issue]: [Location and fix]

Required Changes:

1. Add viewport meta tag:
   <meta name="viewport" content="width=device-width, initial-scale=1">
2. [Other specific fixes]

```

---

### 3.3 Security Analysis

**Check:** Evaluate security configuration.

**Pass Criteria:**
- HTTPS enabled and enforced
- Valid SSL certificate (not expired)
- No mixed content (HTTP resources on HTTPS page)
- Security headers present

**Security Headers to Check:**
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options` or CSP frame-ancestors
- `Content-Security-Policy`
- `Referrer-Policy`

**Fail Criteria:**
- Site served over HTTP (no HTTPS)
- Expired or invalid SSL certificate
- Mixed content blocking resources

**Warning Criteria:**
- Missing HSTS header
- Missing X-Content-Type-Options
- Missing X-Frame-Options
- Weak Content-Security-Policy

**Recommendation Format:**
```

Security Status: [Secure/Issues Found]

SSL Certificate:

- Status: [Valid/Invalid/Expired]
- Expires: [date]
- Issuer: [issuer]

Missing Security Headers:

- [Header]: Add `[Header]: [recommended value]`

Mixed Content Issues:

- [HTTP resource URL] loaded on [HTTPS page]

```

---

## 4. Content Quality Analysis Instructions

### 4.1 Content Depth Analysis

**Check:** Evaluate content quality and depth.

**Pass Criteria:**
- Main content over 300 words for standard pages
- Over 1000 words for in-depth articles/guides
- Content is original (not duplicated from other pages)
- Content answers user intent based on page topic

**Fail Criteria:**
- Page has under 100 words of content
- Content is mostly boilerplate/navigation
- Content is duplicated from another page on the site

**Warning Criteria:**
- Thin content (100-300 words)
- High percentage of boilerplate vs. unique content
- Content doesn't match page title/H1

**Recommendation Format:**
```

Word Count: [count] words
Content Assessment: [Comprehensive/Adequate/Thin]

Content Strengths:

- [positive aspect]

Content Gaps:

- Missing information about: [topic]
- Could expand on: [topic]

Suggested Content Additions:

- Add section about [topic] (~200 words)
- Include FAQ section addressing: [common questions]

````

---

## 5. Competitive Context Instructions

When analyzing a site, consider these industry-specific factors:

### For Professional Services (Accounting, Legal, Consulting):
- Trust signals: Credentials, certifications, team bios
- Service area pages with local schema
- Case studies or testimonials with Review schema
- FAQ content addressing common client questions
- Clear contact information and CTAs

### For E-commerce:
- Product schema on all product pages
- Review/rating schema
- Breadcrumb navigation
- Clear pricing and availability
- Mobile checkout optimization

### For Content/Media Sites:
- Article schema with author information
- Proper date markup (published/modified)
- Category/tag taxonomy
- Related content links
- Fast page loads for ad-supported content

---

## 6. Priority Scoring Instructions

When generating recommendations, score each issue:

**Critical (Must Fix):**
- Blocks search indexing
- Blocks AI crawler access
- Security vulnerabilities
- Major user experience issues
- Core Web Vitals failures

**High (Should Fix):**
- Missing important schema
- Duplicate content issues
- Poor mobile experience
- Slow page load times
- Missing meta descriptions

**Medium (Recommended):**
- Missing social meta tags
- Image optimization
- Minor content improvements
- Additional schema types
- Internal linking improvements

**Low (Nice to Have):**
- Advanced schema types
- Minor performance optimizations
- Accessibility enhancements
- Additional security headers

---

## 7. Report Generation Instructions

When generating the final report:

### Executive Summary
- Overall health score (0-100)
- Top 3 critical issues
- Top 3 quick wins
- Comparison to industry benchmarks

### For Developers
- Exact code snippets to copy/paste
- File paths where changes are needed
- Priority order for implementation
- Estimated effort for each fix

### For Stakeholders
- Business impact of each issue
- Before/after projections
- Competitive comparison
- Timeline recommendations

---

## 8. Planned AI-Powered Semantic Checks

These checks require AI analysis to evaluate semantic meaning and cannot be done programmatically:

### 8.1 URL Semantic Relevance

**Check:** Evaluate if URL slugs semantically match page content.

**What AI Should Analyze:**
- Does the URL accurately describe the page topic?
- Would a user understand the page content from the URL alone?
- Are there better keyword choices that match the content?

**Examples:**
- `/our-approach` for a methodology page → AI determines if "approach" captures the content
- `/services/consulting` for a page about "Strategic Advisory" → AI suggests alignment
- `/blog/post-123` → AI suggests descriptive alternative based on article topic

**Output Format:**
```json
{
  "check_name": "url_semantic_relevance",
  "check_type": "seo",
  "priority": "recommended",
  "status": "warning",
  "details": {
    "message": "URL '/services/stuff' doesn't clearly describe this page about 'Enterprise Cloud Migration Services'. Consider '/services/cloud-migration' for better SEO.",
    "current_url": "/services/stuff",
    "suggested_url": "/services/cloud-migration",
    "page_topic": "Enterprise Cloud Migration Services"
  },
  "display_name": "URL Doesn't Match Content",
  "display_name_passed": "Descriptive URL"
}
````

---

### 8.2 Content-Title Alignment

**Check:** Evaluate if page title accurately represents the content.

**What AI Should Analyze:**

- Does the title promise what the content delivers?
- Is the title misleading or clickbait?
- Could the title better capture the main topic?

---

### 8.3 Meta Description Quality

**Check:** Evaluate if meta description is compelling and accurate.

**What AI Should Analyze:**

- Does the description summarize the page accurately?
- Is it compelling enough to drive clicks?
- Does it include relevant keywords naturally?

---

### 8.4 Content Completeness

**Check:** Evaluate if content fully addresses the topic implied by the title/URL.

**What AI Should Analyze:**

- Are there obvious gaps in the content?
- What questions might users have that aren't answered?
- What related topics should be covered?

---

### 8.5 Call-to-Action Clarity

**Check:** Evaluate if pages have clear, appropriate CTAs.

**What AI Should Analyze:**

- Is there a clear next step for visitors?
- Does the CTA match the page intent?
- Are CTAs visible and compelling?

---

## Reference Links

### Google Documentation

- [Search Central SEO Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Mobile Usability](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)

### Bing Documentation

- [Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [Structured Data](https://www.bing.com/webmasters/help/marking-up-your-site-with-structured-data-3a93e731)

### AI Crawler Documentation

- [OpenAI GPTBot](https://platform.openai.com/docs/gptbot)
- [OpenAI Crawlers Overview](https://platform.openai.com/docs/bots)
- [llms.txt Specification](https://llmstxt.org/)

```

```
