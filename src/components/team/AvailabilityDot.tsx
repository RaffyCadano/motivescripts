/** 🟢 when a URL is present, ⚪ when it isn't -- never a broken link or empty button. */
export function AvailabilityDot({ label, available }: { label: string; available: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--admin-muted)]">
      <span aria-hidden="true">{available ? "🟢" : "⚪"}</span>
      {label}
      {!available ? " not deployed" : ""}
    </span>
  );
}
