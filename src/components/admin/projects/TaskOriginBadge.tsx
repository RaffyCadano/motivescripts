import { UserRound } from "lucide-react";

export function TaskOriginBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(0_80_240_/_0.08)] px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight text-[var(--admin-blue)]">
      <UserRound size={11} strokeWidth={2.2} aria-hidden="true" />
      Client submitted
    </span>
  );
}
