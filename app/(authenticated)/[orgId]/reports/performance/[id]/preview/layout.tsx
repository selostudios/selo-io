/**
 * Preview-route layout.
 *
 * The parent `(authenticated)` layout renders the full app shell (top bar +
 * sidebar). The preview route needs to feel like a true full-viewport deck
 * without the surrounding chrome. We can't strip the parent layout from a
 * child route, so this layout keeps the parent slots intact but removes any
 * default padding a parent `main` might apply, letting the preview client
 * cover the viewport with a `fixed inset-0` overlay.
 */
export default function PerformanceReportPreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="-m-8">{children}</div>
}
