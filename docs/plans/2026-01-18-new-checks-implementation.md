# New Audit Checks Implementation Plan

> **For Claude:** Use superpowers:subagent-driven-development to implement these checks.

## Current Check Inventory

### SEO Checks (9 existing)

| Check                    | File                        | Status    |
| ------------------------ | --------------------------- | --------- |
| missing_title            | missing-title.ts            | ✅ Exists |
| missing_meta_description | missing-meta-description.ts | ✅ Exists |
| meta_description_length  | meta-description-length.ts  | ✅ Exists |
| title_length             | title-length.ts             | ✅ Exists |
| missing_h1               | missing-h1.ts               | ✅ Exists |
| multiple_h1              | multiple-h1.ts              | ✅ Exists |
| heading_hierarchy        | heading-hierarchy.ts        | ✅ Exists |
| images_missing_alt       | images-missing-alt.ts       | ✅ Exists |
| missing_canonical        | missing-canonical.ts        | ✅ Exists |
| thin_content             | thin-content.ts             | ✅ Exists |

### AI Readiness Checks (4 existing)

| Check                   | File                       | Status    |
| ----------------------- | -------------------------- | --------- |
| missing_llms_txt        | missing-llms-txt.ts        | ✅ Exists |
| ai_crawlers_blocked     | ai-crawlers-blocked.ts     | ✅ Exists |
| no_faq_content          | no-faq-content.ts          | ✅ Exists |
| missing_structured_data | missing-structured-data.ts | ✅ Exists |

### Technical Checks (4 existing)

| Check            | File                | Status    |
| ---------------- | ------------------- | --------- |
| missing_ssl      | missing-ssl.ts      | ✅ Exists |
| missing_viewport | missing-viewport.ts | ✅ Exists |
| missing_og_tags  | missing-og-tags.ts  | ✅ Exists |
| missing_favicon  | missing-favicon.ts  | ✅ Exists |

---

## New Checks to Implement

### Priority 1: Critical SEO Checks

#### 1.1 missing_sitemap

**File:** `lib/audit/checks/seo/missing-sitemap.ts`
**Priority:** Critical
**Site-wide:** Yes

```typescript
// Check for XML sitemap at /sitemap.xml
// Also check robots.txt for Sitemap: directive
// Pass: Sitemap exists and is valid XML
// Fail: No sitemap found
// Warning: Sitemap referenced but returns error
```

**Learn More:** https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview

---

#### 1.2 broken_internal_links

**File:** `lib/audit/checks/seo/broken-internal-links.ts`
**Priority:** Critical
**Site-wide:** Yes (aggregates across all pages)

```typescript
// During crawl, track all internal links and their status codes
// Pass: All internal links resolve (200 status)
// Fail: Any internal link returns 404
// Details: List broken links with source pages
```

**Learn More:** https://developers.google.com/search/docs/crawling-indexing/http-network-errors

---

#### 1.3 duplicate_title_tags

**File:** `lib/audit/checks/seo/duplicate-title-tags.ts`
**Priority:** Critical
**Site-wide:** Yes (requires cross-page analysis)

```typescript
// Compare title tags across all crawled pages
// Pass: All titles are unique
// Fail: Multiple pages share the same title
// Details: List duplicate titles and affected URLs
```

**Learn More:** https://developers.google.com/search/docs/appearance/title-link

---

#### 1.4 duplicate_meta_descriptions

**File:** `lib/audit/checks/seo/duplicate-meta-descriptions.ts`
**Priority:** Recommended
**Site-wide:** Yes

```typescript
// Compare meta descriptions across all crawled pages
// Pass: All descriptions are unique
// Warning: Multiple pages share the same description
// Details: List duplicates and affected URLs
```

---

### Priority 2: Critical AI Readiness Checks

#### 2.1 missing_llms_full_txt

**File:** `lib/audit/checks/ai/missing-llms-full-txt.ts`
**Priority:** Recommended
**Site-wide:** Yes

```typescript
// Check for /llms-full.txt companion file
// Pass: File exists with valid markdown content
// Warning: File missing (llms.txt exists but no full version)
// Details: Provide template for creating the file
```

**Learn More:** https://llmstxt.org/

---

#### 2.2 js_rendered_content

**File:** `lib/audit/checks/ai/js-rendered-content.ts`
**Priority:** Critical
**Site-wide:** No (per-page)

```typescript
// Compare raw HTML content length vs rendered content
// Check if main content exists in initial HTML
// Pass: Main content visible in raw HTML
// Fail: Page is blank or minimal without JS
// Warning: Significant content requires JS
```

**Learn More:** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

---

#### 2.3 slow_page_response

**File:** `lib/audit/checks/ai/slow-page-response.ts`
**Priority:** Critical
**Site-wide:** No (per-page)

```typescript
// Measure time to first byte and total load time
// AI crawlers timeout at 1-5 seconds
// Pass: Response under 2 seconds
// Warning: Response 2-5 seconds
// Fail: Response over 5 seconds
```

---

#### 2.4 missing_organization_schema

**File:** `lib/audit/checks/ai/missing-organization-schema.ts`
**Priority:** Recommended
**Site-wide:** Yes (check homepage only)

```typescript
// Check homepage for Organization JSON-LD
// Pass: Valid Organization schema with name, logo, url
// Warning: Schema exists but missing recommended fields
// Fail: No Organization schema on homepage
```

**Learn More:** https://developers.google.com/search/docs/appearance/structured-data/organization

---

### Priority 3: Enhanced SEO Checks

#### 3.1 missing_twitter_cards

**File:** `lib/audit/checks/seo/missing-twitter-cards.ts`
**Priority:** Recommended
**Site-wide:** No

```typescript
// Check for Twitter Card meta tags
// twitter:card, twitter:title, twitter:description, twitter:image
// Pass: All required tags present
// Warning: Partial implementation
// Fail: No Twitter Card tags
```

**Learn More:** https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup

---

#### 3.2 deep_page_depth

**File:** `lib/audit/checks/seo/deep-page-depth.ts`
**Priority:** Recommended
**Site-wide:** Yes

```typescript
// Calculate click depth from homepage for each page
// Pass: All pages within 3 clicks
// Warning: Pages 4-5 clicks deep
// Fail: Pages more than 5 clicks deep
```

**Learn More:** https://developers.google.com/search/docs/crawling-indexing/url-structure

---

#### 3.3 missing_breadcrumb_schema

**File:** `lib/audit/checks/seo/missing-breadcrumb-schema.ts`
**Priority:** Recommended
**Site-wide:** No

```typescript
// Check for BreadcrumbList JSON-LD
// Pass: Valid breadcrumb schema present
// Warning: HTML breadcrumbs exist without schema
// N/A: Homepage (doesn't need breadcrumbs)
```

**Learn More:** https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

---

### Priority 4: Technical Checks

#### 4.1 mixed_content

**File:** `lib/audit/checks/technical/mixed-content.ts`
**Priority:** Critical
**Site-wide:** No

```typescript
// Check for HTTP resources on HTTPS pages
// Images, scripts, stylesheets, iframes
// Pass: All resources use HTTPS
// Fail: HTTP resources found on HTTPS page
// Details: List HTTP resource URLs
```

**Learn More:** https://developers.google.com/search/docs/advanced/security/https

---

#### 4.2 missing_compression

**File:** `lib/audit/checks/technical/missing-compression.ts`
**Priority:** Recommended
**Site-wide:** Yes

```typescript
// Check for Gzip/Brotli compression via headers
// Content-Encoding: gzip or br
// Pass: Compression enabled
// Warning: Compression not enabled
```

---

#### 4.3 missing_cache_headers

**File:** `lib/audit/checks/technical/missing-cache-headers.ts`
**Priority:** Recommended
**Site-wide:** Yes

```typescript
// Check for browser caching headers
// Cache-Control, ETag, Last-Modified
// Pass: Appropriate caching headers set
// Warning: Missing or suboptimal caching
```

---

#### 4.4 missing_security_headers

**File:** `lib/audit/checks/technical/missing-security-headers.ts`
**Priority:** Optional
**Site-wide:** Yes

```typescript
// Check for security headers
// X-Content-Type-Options, X-Frame-Options, CSP, HSTS
// Pass: All critical headers present
// Warning: Missing recommended headers
// Details: List missing headers with recommendations
```

**Learn More:** https://owasp.org/www-project-secure-headers/

---

## Implementation Notes

### Site-Wide Checks

Site-wide checks need special handling:

1. Run once per audit (not per page)
2. May require data from all crawled pages
3. Should be deduplicated in the UI

### Cross-Page Analysis

For checks like duplicate titles/descriptions:

1. Collect data during page crawling
2. Run analysis after all pages crawled
3. Store results with references to affected pages

### Response Time Measurement

For performance checks:

1. Measure during the fetch phase
2. Store timing data with page records
3. Use in checks during analysis phase

### External Fetches

Some checks require additional HTTP requests:

- Sitemap check: Fetch /sitemap.xml
- llms-full.txt: Fetch /llms-full.txt
- robots.txt: Already fetched for ai_crawlers_blocked

Consider batching these fetches efficiently.

---

## Testing Requirements

Each new check needs:

1. Unit test with mock HTML/responses
2. Test for pass condition
3. Test for fail condition
4. Test for warning condition (if applicable)
5. Test for edge cases

---

## Recommended Implementation Order

### Sprint 1: Critical Checks

1. `missing_sitemap`
2. `slow_page_response`
3. `js_rendered_content`
4. `missing_organization_schema`

### Sprint 2: SEO Enhancements

5. `duplicate_title_tags`
6. `duplicate_meta_descriptions`
7. `missing_twitter_cards`
8. `missing_breadcrumb_schema`

### Sprint 3: Technical & Performance

9. `mixed_content`
10. `missing_compression`
11. `missing_cache_headers`
12. `deep_page_depth`

### Sprint 4: Advanced

13. `broken_internal_links`
14. `missing_llms_full_txt`
15. `missing_security_headers`
