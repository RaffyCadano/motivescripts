import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import type { ClientWorkflowState } from "@/components/admin/clients/ClientPreProjectStatus";
import { StaffAssignmentCard } from "@/components/admin/team/StaffAssignmentCard";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ProjectCommercialProgress } from "@/components/admin/projects/ProjectCommercialProgress";
import { ProjectNextAction } from "@/components/admin/projects/ProjectNextAction";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientDate, formatClientTimestamp } from "@/data/agencyClients";
import { adminStatusLabel } from "@/data/documents";
import { adminInvoiceStatusLabel } from "@/data/invoices";
import { portalStatusLabel } from "@/data/invitation";
import { scopeStatus } from "@/data/scopeBriefs";

type ClientPreProjectOverviewProps = {
  client: AgencyClient;
  workflow: ClientWorkflowState;
  canManageProjects: boolean;
  createHref: string;
  onInvite?: () => void;
  onOpenTab: (tab: string) => void;
  onAddNote: () => void;
};

export function ClientPreProjectOverview({
  client,
  workflow,
  canManageProjects,
  createHref,
  onInvite,
  onOpenTab,
  onAddNote,
}: ClientPreProjectOverviewProps) {
  const { profile } = useAuth();
  const { portalAccounts } = useLeads();
  const team = useTeamDirectory();
  const [scopeOpen, setScopeOpen] = useState(false);

  const brief = workflow.brief;
  const pageCount = brief
    ? brief.selectedPages.filter((item) => item !== "Other").length + (brief.otherPages.trim() ? 1 : 0)
    : 0;
  const featureCount = brief
    ? brief.features.filter((item) => item !== "Other").length + (brief.otherFeatures.trim() ? 1 : 0)
    : 0;
  const portalLinked = portalAccounts.some((account) => account.clientId === client.id && account.role === "client");
  const portalStatus = portalLinked ? "linked" : workflow.portalInvited ? "sent" : "not_invited";

  return (
    <div className="space-y-6">
      <ProjectCommercialProgress items={workflow.items} loading={workflow.loading} />
      <ProjectNextAction
        project={null}
        action={workflow.action}
        loading={workflow.loading}
        onInvite={onInvite}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard title="Client">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{client.contactName}</p>
          <p className="mt-2 text-sm">
            <a className="text-[var(--admin-blue)] hover:underline" href={`mailto:${client.email}`}>
              {client.email}
            </a>
          </p>
          <p className="mt-1 text-sm text-[var(--admin-ink)]">{client.phone !== "—" ? client.phone : "Not provided"}</p>
          <p className="mt-3 text-sm text-[var(--admin-muted)]">
            Portal <span className="text-[var(--admin-ink)]">● {portalStatusLabel(portalStatus)}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {portalLinked ? (
              <a href="/client" target="_blank" rel="noreferrer" className={adminGhostBtn}>
                Open portal
              </a>
            ) : isActiveAdmin(profile) && onInvite ? (
              <button type="button" className={adminGhostBtn} onClick={onInvite}>
                Invite
              </button>
            ) : null}
          </div>
        </SummaryCard>

        <SummaryCard title="Website scope">
          {workflow.loading ? (
            <p className="text-sm text-[var(--admin-muted)]">Loading…</p>
          ) : brief && scopeStatus(brief) !== "not_started" ? (
            <>
              <p className="text-sm text-[var(--admin-ink)]">
                {pageCount} page{pageCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-[var(--admin-ink)]">
                {featureCount} feature{featureCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                {brief.submittedAt ? `Submitted ${formatClientDate(brief.submittedAt)}` : "Draft saved"}
              </p>
              <button type="button" className={`${adminGhostBtn} mt-4`} onClick={() => setScopeOpen((open) => !open)}>
                {scopeOpen ? "Hide scope" : "View scope"}
              </button>
              {scopeOpen && brief.goal.trim() ? (
                <p className="mt-4 border-t border-[var(--admin-line)] pt-4 text-sm text-[var(--admin-muted)]">{brief.goal.trim()}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--admin-muted)]">No scope submitted yet.</p>
          )}
        </SummaryCard>
      </div>

      {!workflow.project && canManageProjects ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project</h2>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">No project yet. Create one when you are ready to begin production.</p>
          <Link to={createHref} className={`${adminPrimaryBtn} mt-4 justify-center`}>
            Create Project
          </Link>
        </section>
      ) : null}

      {team.data ? (
        <StaffAssignmentCard
          kind="client"
          entityId={client.id}
          members={team.data.members}
          assignedUserIds={team.data.members
            .filter((member) => member.clientAssignments.some((item) => item.entityId === client.id))
            .map((member) => member.id)}
          assignedLabels={Object.fromEntries(
            team.data.members.flatMap((member) =>
              member.clientAssignments
                .filter((item) => item.entityId === client.id)
                .map((item) => [member.id, item.label]),
            ),
          )}
          onChanged={() => void team.reload()}
        />
      ) : null}

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Documents</h2>
        <dl className="mt-4 divide-y divide-[var(--admin-line)] text-sm">
          <DocumentRow
            label="Proposal"
            value={workflow.proposal ? adminStatusLabel(workflow.proposal.effectiveStatus) : "Not created"}
            href={workflow.proposal ? `/admin/proposals/${workflow.proposal.id}` : undefined}
          />
          <DocumentRow
            label="Contract"
            value={workflow.contract ? adminStatusLabel(workflow.contract.effectiveStatus) : "Not created"}
            href={workflow.contract ? `/admin/contracts/${workflow.contract.id}` : undefined}
          />
          <DocumentRow
            label="Invoice"
            value={workflow.invoices[0] ? adminInvoiceStatusLabel(workflow.invoices[0].effectiveStatus) : "Not created"}
            href={workflow.invoices[0] ? `/admin/invoices/${workflow.invoices[0].id}` : undefined}
          />
        </dl>
        <button
          type="button"
          className="mt-4 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          onClick={() => onOpenTab("agreements")}
        >
          View agreements
        </button>
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Internal notes</h2>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Agency only — never shown in the Client Portal.</p>
          </div>
          <button type="button" className={adminGhostBtn} onClick={onAddNote}>
            Add note
          </button>
        </div>
        {client.notes.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--admin-muted)]">No internal notes yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {client.notes.slice(0, 3).map((note) => (
              <li key={note.id} className="border-t border-[var(--admin-line)] pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm text-[var(--admin-ink)]">{note.body}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                  {note.author} · {formatClientTimestamp(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent activity</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("activity")}
          >
            View all
          </button>
        </div>
        {client.activity.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No activity yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {client.activity.slice(0, 5).map((item) => (
              <li key={item.id}>
                <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatClientDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DocumentRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-[var(--admin-muted)]">{label}</dt>
      <dd>
        {href ? (
          <Link to={href} className="font-medium text-[var(--admin-blue)] hover:underline">
            {value}
          </Link>
        ) : (
          <span className="text-[var(--admin-ink)]">{value}</span>
        )}
      </dd>
    </div>
  );
}
