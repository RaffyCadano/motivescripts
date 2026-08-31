import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { useClientProjects, useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyClient } from "@/data/agencyClients";
import { fetchContractSummaries, fetchProposalSummaries } from "@/data/documentsRepository";
import { fetchClientInvitations } from "@/data/invitationRepository";
import { fetchInvoiceSummaries } from "@/data/invoicesRepository";
import {
  adminClientWorkflowAction,
  adminEngagementLabel,
  adminFunnelCurrentId,
  deriveAdminFunnel,
  isProductionProject,
  salesFlags,
  type AdminFunnelItem,
  type AdminWorkflowAction,
} from "@/data/preProject";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { cn } from "@/lib/cn";

function primaryAllowed(action: AdminWorkflowAction, can: (code: StaffPermissionCode) => boolean): boolean {
  if (action.primaryKind === "start_project") return can("projects.manage");
  const href = action.primaryHref ?? "";
  if (href.includes("/projects/new")) return can("projects.manage");
  if (href.includes("/proposals/new")) return can("proposals.manage");
  if (href.includes("/contracts/new")) return can("contracts.manage");
  if (href.includes("/invoices/new")) return can("invoices.manage");
  if (href.includes("/admin/projects/")) return can("projects.view");
  return true;
}

function secondaryAllowed(action: AdminWorkflowAction, can: (code: StaffPermissionCode) => boolean): boolean {
  const href = action.secondaryHref ?? "";
  if (href.includes("/projects/new")) return can("projects.manage");
  if (href.includes("/admin/projects/")) return can("projects.view");
  return true;
}

export function ClientPreProjectStatus({ client }: { client: AgencyClient }) {
  const { profile } = useAuth();
  const { portalAccounts, setProjectStatus } = useLeads();
  const projects = useClientProjects(client.id);
  const project = projects[0] ?? null;
  const [items, setItems] = useState<AdminFunnelItem[] | null>(null);
  const [action, setAction] = useState<AdminWorkflowAction | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [starting, setStarting] = useState(false);

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
      const invited =
        linked || invitations.some((row) => row.effectiveStatus === "pending" || row.effectiveStatus === "accepted");
      const flags = salesFlags({ brief, project, proposals, contracts, invoices });
      const funnel = deriveAdminFunnel({
        portalInvited: invited,
        hasScope: flags.hasScope,
        hasProject: flags.hasProject,
        proposalAccepted: flags.proposalAccepted,
        contractAccepted: flags.contractAccepted,
        invoicePaid: flags.invoicePaid,
        projectStarted: isProductionProject(flags.projectStatus),
      });
      const acceptedProposal = proposals.find((row) => row.effectiveStatus === "accepted");
      const acceptedContract = contracts.find((row) => row.effectiveStatus === "accepted");
      setItems(funnel);
      setAction(
        adminClientWorkflowAction({
          clientId: client.id,
          portalInvited: invited,
          hasScope: flags.hasScope,
          hasProject: flags.hasProject,
          proposalAccepted: flags.proposalAccepted,
          contractAccepted: flags.contractAccepted,
          invoicePaid: flags.invoicePaid,
          projectStarted: isProductionProject(flags.projectStatus),
          projectId: project?.id ?? null,
          projectStatus: flags.projectStatus,
          acceptedProposalId: acceptedProposal?.id ?? null,
          acceptedContractId: acceptedContract?.id ?? null,
        }),
      );
    });
    return () => {
      active = false;
    };
  }, [client.id, portalAccounts, project, project?.id, project?.status]);

  const label = adminEngagementLabel(Boolean(project), isProductionProject(project?.status));
  const currentId = items ? adminFunnelCurrentId(items) : action?.currentStepId;
  const can = (code: StaffPermissionCode) => hasPermission(profile, code);
  const showPrimary = action && action.primaryKind !== "none" && action.primaryLabel && primaryAllowed(action, can);
  const showSecondary = action && action.secondaryLabel && action.secondaryHref && secondaryAllowed(action, can);

  async function startProject() {
    if (!project?.id || starting) return;
    setStarting(true);
    try {
      await setProjectStatus(project.id, "In Development");
      setStartOpen(false);
    } finally {
      setStarting(false);
    }
  }

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

      {action ? (
        <div className="mt-4 rounded-xl border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">Next action</p>
          <p className="mt-1 font-heading text-sm font-semibold text-[var(--admin-ink)]">{action.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">{action.body}</p>
          {showPrimary || showSecondary ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {showPrimary && action.primaryKind === "link" && action.primaryHref ? (
                <Link to={action.primaryHref} className={`${adminPrimaryBtn} justify-center`}>
                  {action.primaryLabel}
                </Link>
              ) : null}
              {showPrimary && action.primaryKind === "start_project" ? (
                <button type="button" className={`${adminPrimaryBtn} justify-center`} onClick={() => setStartOpen(true)}>
                  {action.primaryLabel}
                </button>
              ) : null}
              {showSecondary ? (
                <Link to={action.secondaryHref!} className={`${adminGhostBtn} justify-center`}>
                  {action.secondaryLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-[var(--admin-bg)]" />
      )}

      {items ? (
        <ol className="mt-4 space-y-1.5">
          {items.map((item) => {
            const current = item.id === currentId && !item.done;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                  current && "bg-[rgb(0_80_240_/_0.06)] ring-1 ring-[rgb(0_80_240_/_0.16)]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full font-heading text-[11px] font-semibold",
                    item.done
                      ? "bg-[rgb(16_185_129_/_0.12)] text-[#0f7a56]"
                      : current
                        ? "bg-[rgb(0_80_240_/_0.12)] text-[var(--admin-blue)]"
                        : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
                  )}
                  aria-hidden="true"
                >
                  {item.done ? "✓" : current ? "→" : "○"}
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
                {current ? (
                  <span className="ml-auto font-heading text-[11px] font-semibold text-[var(--admin-blue)]">Next</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      )}

      <AdminDialog
        open={startOpen}
        busy={starting}
        title="Start production?"
        description="This sets the project status to In Development. Payment is already recorded. You can still manage the project afterward."
        onClose={() => {
          if (!starting) setStartOpen(false);
        }}
      >
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={`${adminGhostBtn} justify-center`} disabled={starting} onClick={() => setStartOpen(false)}>
            Cancel
          </button>
          <button type="button" className={`${adminPrimaryBtn} justify-center`} disabled={starting} onClick={() => void startProject()}>
            {starting ? "Starting…" : "Start Project"}
          </button>
        </div>
      </AdminDialog>
    </section>
  );
}
