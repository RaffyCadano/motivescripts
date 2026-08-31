import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import type { EffectiveInvoiceStatus } from "@/data/invoices";
import { cn } from "@/lib/cn";

const STEPS = ["Draft", "Sent", "Viewed", "Paid"] as const;

function stepIndex(status: EffectiveInvoiceStatus): number {
  switch (status) {
    case "draft":
      return 0;
    case "sent":
      return 1;
    case "viewed":
    case "overdue":
    case "partially_paid":
      return 2;
    case "paid":
      return 3;
    case "cancelled":
      return -1;
  }
}

export function InvoiceWorkflowSteps({
  status,
  className,
}: {
  status: EffectiveInvoiceStatus;
  className?: string;
}) {
  const current = stepIndex(status);
  const extra =
    status === "overdue" || status === "partially_paid" || status === "cancelled" ? status : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px]", className)}>
      {STEPS.map((label, index) => {
        const active = current === index;
        const done = current > index;
        return (
          <span key={label} className="inline-flex items-center gap-2">
            {index > 0 ? <span className="text-[var(--admin-muted)]">→</span> : null}
            <span
              className={cn(
                "font-heading font-semibold tracking-tight",
                active
                  ? "text-[var(--admin-ink)]"
                  : done
                    ? "text-[var(--admin-muted)]"
                    : "text-[rgb(7_17_31_/_0.38)]",
              )}
            >
              {label}
            </span>
          </span>
        );
      })}
      {extra ? <InvoiceStatusBadge status={extra} /> : null}
    </div>
  );
}
