import { useEffect, useState } from "react";
import { useClientProjects, useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyClient } from "@/data/agencyClients";
import { fetchContractSummaries, fetchProposalSummaries } from "@/data/documentsRepository";
import { fetchClientInvitations } from "@/data/invitationRepository";
import { fetchInvoiceSummaries } from "@/data/invoicesRepository";
import {
  adminEngagementLabel,
  deriveAdminFunnel,
  isProductionProject,
  salesFlags,
} from "@/data/preProject";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { cn } from "@/lib/cn";

export function ClientPreProjectStatus({ client }: { client: AgencyClient }) {
  const { portalAccounts } = useLeads();
  const projects = useClientProjects(client.id);
  const project = projects[0] ?? null;
  const [items, setItems] = useState<ReturnType<typeof deriveAdminFunnel> | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchClientScopeBrief(client.id).catch(() => null),
      fetchClientInvitations(client.id).catch(() => []),
      fetchProposalSummaries(client.id).catch(() => []),
      fetchContractSummaries(client.id).catch(() => []),
      fetchInvoiceSummaries(client.id).catch(() => []),
    ]).then(([brief, invitations, proposals, contracts, invoices]) => {
      if (!active) return;
      const linked = portalAccounts.some((account) => account.clientId === client.id && account.role === "client");
      const invited = linked || invitations.some((row) => row.effectiveStatus === "pending" || row.effectiveStatus === "accepted");
      const flags = salesFlags({ brief, project, proposals, contracts, invoices });
      setItems(
        deriveAdminFunnel({
          portalInvited: invited,
          hasScope: flags.hasScope,
          hasProject: flags.hasProject,
          proposalAccepted: flags.proposalAccepted,
          contractAccepted: flags.contractAccepted,
          invoicePaid: flags.invoicePaid,
          projectStarted: isProductionProject(flags.projectStatus),
        }),
      );
    });
    return () => {
      active = false;
    };
  }, [client.id, portalAccounts, project?.id, project]);

  const label = adminEngagementLabel(Boolean(project), isProductionProject(project?.status));

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Client status</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">From live records — not a second pipeline.</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[var(--admin-bg)] px-2.5 py-0.5 font-heading text-[11px] font-semibold text-[var(--admin-ink)]">
          {label}
        </span>
      </div>
      {items ? (
        <ol className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full font-heading text-[11px] font-semibold",
                  item.done
                    ? "bg-[rgb(16_185_129_/_0.12)] text-[#0f7a56]"
                    : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
                )}
                aria-hidden="true"
              >
                {item.done ? "✓" : "○"}
              </span>
              <span className={item.done ? "text-[var(--admin-ink)]" : "text-[var(--admin-muted)]"}>{item.label}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      )}
    </section>
  );
}
