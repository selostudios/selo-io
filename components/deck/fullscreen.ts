/**
 * Returns the current fullscreen element, preferring the standard API and
 * falling back to Safari's webkit-prefixed API (still required on iPad as of
 * iPadOS 17).
 */
export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  if (document.fullscreenElement) return document.fullscreenElement
  // @ts-expect-error - webkitFullscreenElement is not in lib.dom types.
  const webkitEl: Element | null | undefined = document.webkitFullscreenElement
  return webkitEl ?? null
}

/**
 * Enter or exit fullscreen for `el`. Tries the standard API, falls back to
 * the webkit-prefixed API, and silently no-ops if neither is available (or
 * the browser rejects the request for missing user-gesture / iframe
 * permissions).
 */
export function toggleElementFullscreen(el: HTMLElement | null): void {
  if (!el) return

  const currentFullscreenEl = getFullscreenElement()

  if (currentFullscreenEl === el) {
    if (typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {})
      return
    }
    // @ts-expect-error - webkitExitFullscreen is not in lib.dom types.
    const webkitExit: (() => Promise<void> | void) | undefined = document.webkitExitFullscreen
    if (typeof webkitExit === 'function') {
      try {
        const result = webkitExit.call(document)
        if (result && typeof (result as Promise<void>).catch === 'function') {
          ;(result as Promise<void>).catch(() => {})
        }
      } catch {
        /* no-op */
      }
    }
    return
  }

  if (typeof el.requestFullscreen === 'function') {
    el.requestFullscreen().catch(() => {})
    return
  }
  // @ts-expect-error - webkitRequestFullscreen is not in lib.dom types.
  const webkitRequest: (() => Promise<void> | void) | undefined = el.webkitRequestFullscreen
  if (typeof webkitRequest === 'function') {
    try {
      const result = webkitRequest.call(el)
      if (result && typeof (result as Promise<void>).catch === 'function') {
        ;(result as Promise<void>).catch(() => {})
      }
    } catch {
      /* no-op */
    }
  }
}
