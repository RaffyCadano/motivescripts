import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { InviteClientDialog } from "@/components/admin/clients/InviteClientDialog";
import { ClientNoteModal } from "@/components/admin/clients/ClientNoteModal";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { EditWebsiteUrlsModal } from "@/components/admin/projects/EditWebsiteUrlsModal";
import { ProjectDiscoveryPanel } from "@/components/admin/projects/ProjectDiscoveryPanel";
import { ProjectCommercialProgress } from "@/components/admin/projects/ProjectCommercialProgress";
import { ProjectNextAction } from "@/components/admin/projects/ProjectNextAction";
import { ProjectOverviewTeam } from "@/components/admin/projects/ProjectOverviewTeam";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import type { ProjectWorkflowState } from "@/components/admin/projects/useProjectWorkflowState";
import type { AgencyClient } from "@/data/agencyClients";
import { formatClientDate, formatClientTimestamp } from "@/data/agencyClients";
import { adminStatusLabel } from "@/data/documents";
import { adminInvoiceStatusLabel } from "@/data/invoices";
import { portalStatusLabel } from "@/data/invitation";
import {
  calculateProjectProgress,
  formatProjectDate,
  formatProjectDay,
  type AgencyProject,
} from "@/data/agencyProjects";
import { scopeStatus } from "@/data/scopeBriefs";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";

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
      <ProjectNextAction
        project={project}
        action={workflow.action}
        loading={workflow.loading}
        onInvite={client && isActiveAdmin(profile) ? () => setInviteOpen(true) : undefined}
      />

      {client ? <ProjectDiscoveryPanel projectId={project.id} clientId={client.id} projectName={project.name} brief={brief} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard title="Project">
          <SummaryRow label="Status" value={<ProjectStatusBadge status={project.status} />} />
          <SummaryRow label="Progress" value={`${progress}%`} />
          <SummaryRow label="Type" value={project.type} />
          <SummaryRow label="Pages" value={brief ? String(pageCount) : "—"} />
          <SummaryRow label="Features" value={brief ? String(featureCount) : "—"} />
          <SummaryRow
            label="Staging"
            value={
              stagingHref ? (
                <a className="text-[var(--admin-blue)] hover:underline" href={stagingHref} target="_blank" rel="noreferrer">
                  {displayHttpHost(stagingHref)}
                </a>
              ) : (
                <span className="text-[var(--admin-muted)]">Not available yet</span>
              )
            }
          />
          <SummaryRow
            label="Production"
            value={
              productionHref ? (
                <a className="text-[var(--admin-blue)] hover:underline" href={productionHref} target="_blank" rel="noreferrer">
                  {displayHttpHost(productionHref)}
                </a>
              ) : (
                <span className="text-[var(--admin-muted)]">Not available yet</span>
              )
            }
          />
        </SummaryCard>

        {client ? (
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
              <Link to={`/admin/clients/${client.id}`} className={adminGhostBtn}>
                Manage client
              </Link>
              {!portalLinked && isActiveAdmin(profile) ? (
                <button type="button" className={adminGhostBtn} onClick={() => setInviteOpen(true)}>
                  Invite
                </button>
              ) : null}
            </div>
          </SummaryCard>
        ) : null}

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
              {scopeOpen ? (
                <div className="mt-4 space-y-2 border-t border-[var(--admin-line)] pt-4 text-sm text-[var(--admin-muted)]">
                  {brief.goal.trim() ? <p>{brief.goal.trim()}</p> : null}
                  {client ? (
                    <Link to={`/admin/clients/${client.id}#website-scope`} className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
                      Open full scope on client
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--admin-muted)]">No scope submitted yet.</p>
          )}
        </SummaryCard>
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
            value={
              workflow.invoices[0]
                ? adminInvoiceStatusLabel(workflow.invoices[0].effectiveStatus)
                : "Not created"
            }
            href={workflow.invoices[0] ? `/admin/invoices/${workflow.invoices[0].id}` : undefined}
          />
        </dl>
        <button type="button" className="mt-4 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline" onClick={() => onOpenTab("files")}>
          View project files
        </button>
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Website</h2>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Staging, production, and deliverables.</p>
          </div>
          <button type="button" className={adminGhostBtn} onClick={() => setEditUrlsOpen(true)}>
            Edit URLs
          </button>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <SummaryRow label="Staging" value={stagingHref ? displayHttpHost(stagingHref) : "Not available yet"} />
          <SummaryRow label="Production" value={productionHref ? displayHttpHost(productionHref) : "Not available yet"} />
          <SummaryRow label="Target launch" value={summaryValue(formatProjectDay(project.targetLaunchDate))} />
          <SummaryRow label="Started" value={summaryValue(formatProjectDay(project.startDate))} />
        </dl>
        <button type="button" className="mt-4 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline" onClick={() => onOpenTab("files")}>
          View deliverables
        </button>
      </section>

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

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[var(--admin-ink)]">{value}</dd>
    </div>
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
