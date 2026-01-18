# Selo UI Guidelines

> Based on [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines)

This file provides UI/UX standards for AI assistants and developers working on the Selo codebase.

---

## Accessibility & Interaction

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Keyboard navigation (WAI-ARIA) | ⬜ | Audit all interactive elements for keyboard support |
| Visible focus rings (`:focus-visible`) | ⬜ | Add focus styles to global CSS |
| Input font size ≥16px on mobile | ⬜ | Check form inputs to prevent iOS auto-zoom |
| Hit targets: 24px desktop, 44px mobile | ⬜ | Audit button/link sizes |
| Never disable browser zoom/paste | ✅ | Verify not blocked |

---

## Loading States

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Loading buttons show indicator + label | ⬜ | Update Button component |
| Skeleton loaders match final layout | ⬜ | Create skeleton components |
| 150-300ms delay before showing loader | ⬜ | Add delay to prevent flicker |
| 300-500ms minimum loader visibility | ⬜ | Prevent flash of loading state |
| Destructive actions require confirmation | ⬜ | Add confirm dialogs for delete actions |

---

## Navigation & State

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| URL persistence for stateful UI | ⬜ | Use URL params for filters/tabs/pagination |
| Optimistic UI updates | ⬜ | Update UI immediately, rollback on failure |
| Deep-link all stateful UI | ⬜ | Audit tabs, filters, modals |
| Scroll position restoration | ⬜ | Implement on navigation |

---

## Animation

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Honor `prefers-reduced-motion` | ⬜ | Add media query check |
| Use CSS transitions over JS | ⬜ | Prefer CSS for simple animations |
| GPU-accelerated properties only | ⬜ | Use transform/opacity, not width/height |
| Never use `transition: all` | ⬜ | Audit existing transitions |

---

## Typography & Content

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Curly quotes ("") not straight | ⬜ | Update copy/content |
| `tabular-nums` for number comparisons | ⬜ | Add to metric displays |
| Non-breaking space between number and unit | ⬜ | Use `10 MB` not `10MB` |
| Ellipsis character (…) not three dots | ⬜ | Update truncation |
| Icons require text labels or aria-label | ⬜ | Audit icon buttons |

---

## Forms

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Every input has `<label>` | ⬜ | Audit form fields |
| Enter submits single-input forms | ⬜ | Check form behavior |
| Validate on submit, not on keystroke | ⬜ | Review validation logic |
| Set `autocomplete` attributes | ⬜ | Add to all form fields |
| Placeholders end with ellipsis | ⬜ | Update placeholder text |
| Don't pre-disable submit buttons | ⬜ | Allow submission to show errors |

---

## Performance

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| POST/PATCH/DELETE < 500ms | ⬜ | Monitor API response times |
| Virtualize large lists | ⬜ | Add for prompt results lists |
| Lazy-load below-fold images | ⬜ | Use `loading="lazy"` |
| Preconnect to CDN domains | ⬜ | Add `<link rel="preconnect">` |
| Set explicit image dimensions | ⬜ | Prevent layout shifts |

---

## Visual Design

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Layered shadows (ambient + direct) | ⬜ | Update shadow tokens |
| Semi-transparent borders with shadows | ⬜ | Refine card styles |
| Child border-radius ≤ parent | ⬜ | Check nested rounded elements |
| Color-blind-friendly chart palettes | ⬜ | Update chart colors |
| APCA contrast over WCAG 2 | ⬜ | Audit text contrast |
| `color-scheme: dark` on html | ⬜ | Add for dark mode scrollbars |
| `<meta name="theme-color">` | ⬜ | Add to match page background |

---

## Mobile

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| `touch-action: manipulation` | ⬜ | Prevent double-tap zoom |
| CSS `env()` for safe areas | ⬜ | Handle notched devices |
| Test at 50% zoom for ultra-wide | ⬜ | QA responsive behavior |

---

## Copy & Voice

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Active voice in all copy | ⬜ | Review UI text |
| Title Case for headings/buttons | ⬜ | Audit casing |
| Action-oriented CTAs | ⬜ | Update button labels |
| Use `&` instead of "and" | ⬜ | Review copy |
| Numerals for counts ("8 deployments") | ⬜ | Update number formatting |
| Error messages guide solutions | ⬜ | Review error handling |

---

## Implementation Priority

### Phase 1 - Foundation
1. Focus states and keyboard navigation
2. Loading states (buttons, skeletons)
3. Form accessibility (labels, autocomplete)
4. Typography fixes (tabular-nums, quotes)

### Phase 2 - Polish
1. URL state persistence
2. Animation refinements
3. Performance optimizations
4. Visual design tokens

### Phase 3 - Advanced
1. Optimistic UI
2. Reduced motion support
3. Dark mode enhancements
4. Mobile safe areas
