import { useEffect, useState } from "react";
import { useClientProjects, useLeads } from "@/components/admin/leads/LeadsProvider";
import { fetchContractSummaries, fetchProposalSummaries } from "@/data/documentsRepository";
import { fetchClientInvitations } from "@/data/invitationRepository";
import { fetchInvoiceSummaries } from "@/data/invoicesRepository";
import { deriveLeadFunnel, leadFunnelCurrentId, salesFlags, type AdminFunnelItem } from "@/data/preProject";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { cn } from "@/lib/cn";

type LeadWorkflowProps = {
  converted: boolean;
  clientId: string | null;
};

export function LeadWorkflow({ converted, clientId }: LeadWorkflowProps) {
  const { portalAccounts } = useLeads();
  const projects = useClientProjects(clientId ?? undefined);
  const project = projects[0] ?? null;
  const [later, setLater] = useState<AdminFunnelItem[] | null>(converted ? null : deriveLeadFunnel({ converted: false }));

  useEffect(() => {
    if (!converted || !clientId) {
      setLater(deriveLeadFunnel({ converted: false }));
      return;
    }

    let active = true;
    setLater(deriveLeadFunnel({ converted: true }));
    void Promise.all([
      fetchClientScopeBrief(clientId).catch(() => null),
      fetchClientInvitations(clientId).catch(() => []),
      fetchProposalSummaries(clientId).catch(() => []),
      fetchContractSummaries(clientId).catch(() => []),
      fetchInvoiceSummaries(clientId).catch(() => []),
    ]).then(([brief, invitations, proposals, contracts, invoices]) => {
      if (!active) return;
      const linked = portalAccounts.some((account) => account.clientId === clientId && account.role === "client");
      const invited =
        linked || invitations.some((row) => row.effectiveStatus === "pending" || row.effectiveStatus === "accepted");
      const flags = salesFlags({ brief, project, proposals, contracts, invoices });
      setLater(
        deriveLeadFunnel({
          converted: true,
          portalInvited: invited,
          hasScope: flags.hasScope,
          hasProject: flags.hasProject,
          proposalAccepted: flags.proposalAccepted,
          contractAccepted: flags.contractAccepted,
          hasInvoice: invoices.length > 0,
          invoicePaid: flags.invoicePaid,
        }),
      );
    });

    return () => {
      active = false;
    };
  }, [clientId, converted, portalAccounts, project, project?.id, project?.status]);

  const items = later ?? deriveLeadFunnel({ converted });
  const currentId = leadFunnelCurrentId(items, converted);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Workflow</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        Commercial path from live records. This strip does not advance steps or create records.
      </p>
      <ol className="mt-4 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
        {items.map((item) => {
          const current = item.id === currentId && !item.done;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm sm:px-2.5",
                current && "bg-[rgb(0_80_240_/_0.06)] ring-1 ring-[rgb(0_80_240_/_0.16)]",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center font-heading text-[12px] font-semibold",
                  item.done
                    ? "text-[#0f7a56]"
                    : current
                      ? "text-[var(--admin-blue)]"
                      : "text-[var(--admin-muted)]",
                )}
                aria-hidden="true"
              >
                {item.done ? "✓" : current ? "●" : "○"}
              </span>
              <span
                className={
                  item.done
                    ? "text-[var(--admin-ink)]"
                    : current
                      ? "font-heading font-semibold text-[var(--admin-ink)]"
                      : "text-[var(--admin-muted)]"
                }
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
