import { Ban, Check, CircleDot, FileText, Phone, Sparkles } from "lucide-react";
import type { LeadStatus } from "@/data/leads";
import { cn } from "@/lib/cn";

const styles: Record<LeadStatus, string> = {
  New: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Contacted: "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Qualified: "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  Proposal: "bg-[rgb(0_96_255_/_0.1)] text-[var(--admin-bright)]",
  Won: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  Lost: "bg-[rgb(7_17_31_/_0.06)] text-[var(--admin-muted)]",
};

const icons = {
  New: CircleDot,
  Contacted: Phone,
  Qualified: Sparkles,
  Proposal: FileText,
  Won: Check,
  Lost: Ban,
} as const;

type LeadStatusBadgeProps = {
  status: LeadStatus;
};

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        styles[status],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {status}
    </span>
  );
}
