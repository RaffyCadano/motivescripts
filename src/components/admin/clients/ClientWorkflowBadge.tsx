import { Check, FileText, FolderKanban, Hammer, Receipt, ScrollText, Sparkles } from "lucide-react";
import type { ClientCommercialStage } from "@/data/preProject";
import { cn } from "@/lib/cn";

const styles: Record<ClientCommercialStage, string> = {
  "Pre-Project": "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Project: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Proposal: "bg-[rgb(0_96_255_/_0.1)] text-[var(--admin-bright)]",
  Contract: "bg-[rgb(0_80_240_/_0.06)] text-[var(--admin-navy)]",
  Invoice: "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  Production: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  Complete: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
};

const icons = {
  "Pre-Project": Sparkles,
  Project: FolderKanban,
  Proposal: FileText,
  Contract: ScrollText,
  Invoice: Receipt,
  Production: Hammer,
  Complete: Check,
} as const;

export function ClientWorkflowBadge({ stage }: { stage: ClientCommercialStage }) {
  const Icon = icons[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        styles[stage],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {stage}
    </span>
  );
}
