export function TextPostPlaceholder() {
  return (
    <div
      data-testid="text-post-placeholder"
      className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-neutral-200 text-neutral-500"
      aria-hidden="true"
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 17h2.5l2-4H8V7h6v6l-2 4h-2.5l2 4H7zm10 0h2.5l2-4H18V7h6v6l-2 4h-2.5l2 4H17z" />
      </svg>
    </div>
  )
}
