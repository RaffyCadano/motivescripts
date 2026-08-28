import { Ban, Check, Clock3, Eye, FileEdit, Mail, X } from "lucide-react";
import { adminStatusLabel, clientStatusLabel, type DocumentStatus } from "@/data/documents";
import { cn } from "@/lib/cn";

const styles: Record<DocumentStatus, string> = {
  draft: "bg-[rgb(7_17_31_/_0.06)] text-[#667085]",
  sent: "bg-[rgb(0_80_240_/_0.08)] text-[#0050f0]",
  viewed: "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  accepted: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  declined: "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
  expired: "bg-[rgb(7_17_31_/_0.06)] text-[#667085]",
  cancelled: "bg-[rgb(7_17_31_/_0.06)] text-[#667085]",
};

const icons = {
  draft: FileEdit,
  sent: Mail,
  viewed: Eye,
  accepted: Check,
  declined: X,
  expired: Clock3,
  cancelled: Ban,
} as const;

export function DocumentStatusBadge({
  status,
  audience = "admin",
}: {
  status: DocumentStatus;
  audience?: "admin" | "client";
}) {
  const Icon = icons[status];
  const label = audience === "client" ? clientStatusLabel(status) : adminStatusLabel(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        styles[status],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </span>
  );
}
