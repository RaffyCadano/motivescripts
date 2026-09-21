/** Shown for the moment it takes to fetch the code for a page that loads on demand. */
export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="grid min-h-[50vh] place-items-center px-6 text-sm text-[var(--color-muted,#556070)]">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Loading…
      </span>
    </div>
  );
}
