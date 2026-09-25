import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { InviteClientDialog } from "@/components/admin/clients/InviteClientDialog";
import { ClientNoteModal } from "@/components/admin/clients/ClientNoteModal";
import { useLeads, useProjectDeliverables } from "@/components/admin/leads/LeadsProvider";
import { EditWebsiteUrlsModal } from "@/components/admin/projects/EditWebsiteUrlsModal";
import { WebsiteBackupsCard } from "@/components/admin/projects/WebsiteBackupsCard";
import { WebsiteHealthCard } from "@/components/admin/projects/WebsiteHealthCard";
import { ProjectDiscoveryPanel } from "@/components/admin/projects/ProjectDiscoveryPanel";
import { ProjectCommercialProgress } from "@/components/admin/projects/ProjectCommercialProgress";
import { ProjectDeliveryProgress } from "@/components/admin/projects/ProjectDeliveryProgress";
import { ProjectNextAction } from "@/components/admin/projects/ProjectNextAction";
import { ProjectOverviewTeam } from "@/components/admin/projects/ProjectOverviewTeam";
import { ProjectClientCard, ProjectFactsCard, ProjectScopeCard } from "@/components/admin/projects/ProjectSummaryCards";
import { ProjectDocumentsPanel, ProjectWebsitePanel } from "@/components/admin/projects/ProjectOverviewPanels";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import type { ProjectWorkflowState } from "@/components/admin/projects/useProjectWorkflowState";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientTimestamp } from "@/data/agencyClients";
import { adminStatusLabel } from "@/data/documents";
import { deliverableApprovalStats } from "@/data/files";
import { adminInvoiceStatusLabel } from "@/data/invoices";
import {
  calculateProjectProgress,
  formatProjectDate,
  formatProjectDay,
  type AgencyProject,
} from "@/data/agencyProjects";
import { safeHttpHref } from "@/lib/safeUrl";

type ProjectOverviewProps = {
  project: AgencyProject;
  client: AgencyClient | null;
  workflow: ProjectWorkflowState;
  onOpenTab: (tab: string) => void;
};

function summaryValue(value: string) {
  return value.trim() || "Not set";
}

export function ProjectOverview({ project, client, workflow, onOpenTab }: ProjectOverviewProps) {
  const { profile } = useAuth();
  const { addClientNote, portalAccounts, reload } = useLeads();
  const team = useTeamDirectory();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [editUrlsOpen, setEditUrlsOpen] = useState(false);

  const progress = calculateProjectProgress(project);
  const deliverables = useProjectDeliverables(project.id);
  const deliverableStats = deliverableApprovalStats(deliverables);
  const brief = workflow.brief;
  const pageCount = brief
    ? brief.selectedPages.filter((item) => item !== "Other").length + (brief.otherPages.trim() ? 1 : 0)
    : 0;
  const featureCount = brief
    ? brief.features.filter((item) => item !== "Other").length + (brief.otherFeatures.trim() ? 1 : 0)
    : 0;
  const stagingHref = safeHttpHref(project.development.stagingUrl);
  const productionHref = safeHttpHref(project.development.productionUrl);
  const portalLinked = client
    ? portalAccounts.some((account) => account.clientId === client.id && account.role === "client")
    : false;
  const portalStatus = portalLinked ? "linked" : workflow.portalInvited ? "sent" : "not_invited";
  const assignedLabels = team.data
    ? Object.fromEntries(
        team.data.members.flatMap((member) =>
          member.projectAssignments
            .filter((item) => item.entityId === project.id)
            .map((item) => [member.id, item.label]),
        ),
      )
    : {};

  return (
    <div className="space-y-6">
      <ProjectCommercialProgress items={workflow.items} loading={workflow.loading} />
      <ProjectDeliveryProgress
        project={project}
        deliverables={deliverables}
        invoiceStatuses={workflow.invoices.map((item) => item.status)}
      />
      <ProjectNextAction
        project={project}
        action={workflow.action}
        loading={workflow.loading}
        onInvite={client && isActiveAdmin(profile) ? () => setInviteOpen(true) : undefined}
      />

      {client ? <ProjectDiscoveryPanel projectId={project.id} clientId={client.id} projectName={project.name} brief={brief} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <ProjectFactsCard
          project={project}
          progress={progress}
          deliverables={deliverableStats}
          pages={brief ? pageCount : null}
          features={brief ? featureCount : null}
          stagingHref={stagingHref}
          productionHref={productionHref}
        />
        {client ? (
          <ProjectClientCard
            client={client}
            portalLinked={portalLinked}
            portalStatus={portalStatus}
            canInvite={isActiveAdmin(profile)}
            onInvite={() => setInviteOpen(true)}
          />
        ) : null}
        <ProjectScopeCard
          loading={workflow.loading}
          brief={brief}
          pages={pageCount}
          features={featureCount}
          open={scopeOpen}
          onToggle={() => setScopeOpen((open) => !open)}
          clientId={client?.id ?? null}
        />
      </div>

      {team.data ? (
        <ProjectOverviewTeam
          members={team.data.members}
          projectId={project.id}
          clientId={project.clientId}
          assignedLabels={assignedLabels}
          onChanged={() => void team.reload()}
        />
      ) : null}

      <ProjectDocumentsPanel
        onOpenFiles={() => onOpenTab("files")}
        rows={[
          {
            id: "proposal",
            label: "Proposal",
            value: workflow.proposal ? adminStatusLabel(workflow.proposal.effectiveStatus) : "Not created",
            created: Boolean(workflow.proposal),
            href: workflow.proposal ? `/admin/proposals/${workflow.proposal.id}` : undefined,
          },
          {
            id: "contract",
            label: "Contract",
            value: workflow.contract ? adminStatusLabel(workflow.contract.effectiveStatus) : "Not created",
            created: Boolean(workflow.contract),
            href: workflow.contract ? `/admin/contracts/${workflow.contract.id}` : undefined,
          },
          {
            id: "invoice",
            label: "Invoice",
            value: workflow.invoices[0] ? adminInvoiceStatusLabel(workflow.invoices[0].effectiveStatus) : "Not created",
            created: Boolean(workflow.invoices[0]),
            href: workflow.invoices[0] ? `/admin/invoices/${workflow.invoices[0].id}` : undefined,
          },
        ]}
      />

      <ProjectWebsitePanel
        stagingHref={stagingHref}
        productionHref={productionHref}
        targetLaunch={summaryValue(formatProjectDay(project.targetLaunchDate))}
        started={summaryValue(formatProjectDay(project.startDate))}
        onEditUrls={() => setEditUrlsOpen(true)}
        onOpenFiles={() => onOpenTab("files")}
      />

      <WebsiteHealthCard
        projectId={project.id}
        productionUrl={project.development.productionUrl}
        stagingUrl={project.development.stagingUrl}
        canCheckNow={hasPermission(profile, "projects.manage")}
      />

      <WebsiteBackupsCard projectId={project.id} canBackUpNow={hasPermission(profile, "projects.manage")} />

      {client ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Internal notes</h2>
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Agency only — never shown in the Client Portal.</p>
            </div>
            <button type="button" className={adminGhostBtn} onClick={() => setNoteOpen(true)}>
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
          {client.notes.length > 3 ? (
            <Link to={`/admin/clients/${client.id}#overview`} className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
              View all notes on client
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent activity</h2>
          <button type="button" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline" onClick={() => onOpenTab("activity")}>
            View all
          </button>
        </div>
        {project.activity.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No activity yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {project.activity.slice(0, 5).map((item) => (
              <li key={item.id}>
                <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatProjectDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {client ? (
        <>
          <InviteClientDialog
            client={client}
            open={inviteOpen}
            mode="send"
            onClose={() => setInviteOpen(false)}
            onSent={() => setInviteOpen(false)}
          />
          <ClientNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={(body) => addClientNote(client.id, body)} />
        </>
      ) : null}

      <EditWebsiteUrlsModal
        project={project}
        open={editUrlsOpen}
        onClose={() => setEditUrlsOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  );
}

/** The plain card the team's project page still uses; the admin overview now has its own (ProjectSummaryCards). */
export function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[var(--admin-ink)]">{value}</dd>
    </div>
  );
}
