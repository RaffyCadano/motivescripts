import { AlertTriangle, Ban, Check, Eye, FileEdit, Mail, Wallet } from "lucide-react";
import { adminInvoiceStatusLabel, clientInvoiceStatusLabel, type EffectiveInvoiceStatus } from "@/data/invoices";
import { cn } from "@/lib/cn";

const styles: Record<EffectiveInvoiceStatus, string> = {
  draft: "bg-[rgb(7_17_31_/_0.06)] text-[#667085]",
  sent: "bg-[rgb(0_80_240_/_0.08)] text-[#0050f0]",
  viewed: "bg-[rgb(0_200_255_/_0.12)] text-[#0077aa]",
  partially_paid: "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
  paid: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  overdue: "bg-[rgb(220_38_38_/_0.08)] text-[#b42318]",
  cancelled: "bg-[rgb(7_17_31_/_0.06)] text-[#667085]",
};

const icons = {
  draft: FileEdit,
  sent: Mail,
  viewed: Eye,
  partially_paid: Wallet,
  paid: Check,
  overdue: AlertTriangle,
  cancelled: Ban,
} as const;

export function InvoiceStatusBadge({
  status,
  audience = "admin",
  label,
}: {
  status: EffectiveInvoiceStatus;
  audience?: "admin" | "client";
  label?: string;
}) {
  const Icon = icons[status];
  const text = label ?? (audience === "client" ? clientInvoiceStatusLabel(status) : adminInvoiceStatusLabel(status));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight",
        styles[status],
      )}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
      {text}
    </span>
  );
}
