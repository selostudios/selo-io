import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  /** Visible label for this crumb. */
  label: string
  /**
   * Navigation target. When `undefined`, the item renders as plain text and
   * is marked with `aria-current="page"` — by convention this is the last
   * item (the current page).
   */
  href?: string
}

export interface ReviewBreadcrumbProps {
  items: BreadcrumbItem[]
}

/**
 * Small, purpose-built breadcrumb for the performance-review routes.
 *
 * The snapshots list and snapshot detail pages need identical breadcrumb
 * chrome; extracting this avoids duplicating the `<nav><ol>` markup, the
 * chevron separators, and the "last item has aria-current" rule in two
 * places. Intentionally minimal — no shadcn primitive, just Tailwind and
 * lucide.
 */
export function ReviewBreadcrumb({ items }: ReviewBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" data-testid="review-breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1"
              {...(isLast || !item.href ? { 'aria-current': 'page' as const } : {})}
            >
              {item.href ? (
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
              {!isLast && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
