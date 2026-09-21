import type { DeploymentStatus } from "@/data/projectDevelopment";
import { cn } from "@/lib/cn";

const deploymentStatusStyles: Record<DeploymentStatus, string> = {
  "Not deployed": "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
  Development: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  Staging: "bg-[rgb(245_158_11_/_0.12)] text-[#b45309]",
  Production: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
  "Deployment issue": "bg-[rgb(220_38_38_/_0.1)] text-[#b91c1c]",
};

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-heading text-xs font-semibold tracking-tight",
        deploymentStatusStyles[status],
      )}
    >
      {status}
    </span>
  );
}
