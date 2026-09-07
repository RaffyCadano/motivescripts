/** Small pill next to a section heading showing how many items need attention -- hidden at zero. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--admin-bg)] px-1.5 font-heading text-[11px] font-semibold text-[var(--admin-muted)]">
      {count}
    </span>
  );
}
