import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { useProjectDeliverables, useProjectReview } from "@/components/admin/leads/LeadsProvider";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { MilestoneStatusBadge } from "@/components/admin/projects/MilestoneStatusBadge";
import { ProjectDevelopmentSection } from "@/components/admin/projects/ProjectDevelopmentSection";
import { ProjectDocumentsCard } from "@/components/admin/projects/ProjectDocumentsCard";
import { ProjectInvoicesCard } from "@/components/admin/projects/ProjectInvoicesCard";
import { ProjectProductionPath } from "@/components/admin/projects/ProjectProductionPath";
import { ProjectProductionPipeline } from "@/components/admin/projects/ProjectProductionPipeline";
import { ProjectProductionTasksCard } from "@/components/admin/projects/ProjectProductionTasksCard";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { ProjectTeamRoster } from "@/components/admin/projects/ProjectTeamRoster";
import { ProjectWorkflow } from "@/components/admin/projects/ProjectWorkflow";
import { deriveProductionPath } from "@/data/projectWorkspace";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import type { AgencyClient } from "@/data/agencyClients";
import { currentVersion, formatFileRelative, recentDeliverables, versionLabel } from "@/data/files";
import { fetchContractSummaries, fetchProposalSummaries, type ContractSummary, type ProposalSummary } from "@/data/documentsRepository";
import { fetchInvoiceSummaries, type InvoiceSummary } from "@/data/invoicesRepository";
import {
  isProductionProject,
  projectWorkspaceFunnel,
  salesFlags,
  type AdminFunnelItem,
} from "@/data/preProject";
import { awaitingReview, latestFeedback, needsAttention } from "@/data/review";
import {
  calculateProjectProgress,
  currentMilestone,
  formatProjectDate,
  formatProjectDay,
  milestoneTaskCounts,
  taskCounts,
  type AgencyProject,
} from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import type { ClientScopeBrief } from "@/data/scopeBriefs";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";

type ProjectOverviewProps = {
  project: AgencyProject;
  client: AgencyClient | null;
  onOpenTab: (tab: string) => void;
};

function shortenGoal(value: string, max = 160) {
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

function forProject<T extends { projectId: string | null }>(rows: T[], projectId: string) {
  return rows.filter((row) => row.projectId === projectId);
}

export function ProjectOverview({ project, client, onOpenTab }: ProjectOverviewProps) {
  const progress = calculateProjectProgress(project);
  const counts = taskCounts(project);
  const milestone = currentMilestone(project);
  const milestoneCounts = milestone ? milestoneTaskCounts(project, milestone.id) : null;
  const deliverables = useProjectDeliverables(project.id);
  const recentFiles = recentDeliverables(deliverables);
  const review = useProjectReview(project.id);
  const team = useTeamDirectory();
  const waiting = awaitingReview(deliverables);
  const attention = needsAttention(deliverables);
  const openFeedback = review.feedback.filter((item) => item.status === "Open");
  const resolvedFeedback = review.feedback.filter((item) => item.status === "Resolved");
  const latest = latestFeedback(review.feedback);
  const approvedCount = deliverables.filter((item) => item.status === "Approved").length;
  const latestDeliverable = latest ? deliverables.find((item) => item.id === latest.deliverableId) : null;
  const latestVersion = latest
    ? latestDeliverable?.versions.find((entry) => entry.id === latest.versionId)
    : undefined;

  const [recordsLoading, setRecordsLoading] = useState(true);
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [proposal, setProposal] = useState<ProposalSummary | null>(null);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [workflow, setWorkflow] = useState<AdminFunnelItem[] | null>(null);
  const [invoicePaid, setInvoicePaid] = useState(false);

  useEffect(() => {
    let active = true;
    setRecordsLoading(true);
    void Promise.all([
      fetchClientScopeBrief(project.clientId).catch(() => null),
      fetchProposalSummaries(project.clientId).catch(() => [] as ProposalSummary[]),
      fetchContractSummaries(project.clientId).catch(() => [] as ContractSummary[]),
      fetchInvoiceSummaries(project.clientId).catch(() => [] as InvoiceSummary[]),
    ]).then(([nextBrief, proposals, contracts, nextInvoices]) => {
      if (!active) return;
      const projectProposals = forProject(proposals, project.id);
      const projectContracts = forProject(contracts, project.id);
      const projectInvoices = forProject(nextInvoices, project.id);
      const flags = salesFlags({
        brief: nextBrief,
        project,
        proposals: projectProposals,
        contracts: projectContracts,
        invoices: projectInvoices,
      });
      setBrief(nextBrief);
      setProposal(projectProposals[0] ?? null);
      setContract(projectContracts[0] ?? null);
      setInvoicePaid(flags.invoicePaid);
      setWorkflow(
        projectWorkspaceFunnel({
          hasScope: flags.hasScope,
          proposalAccepted: flags.proposalAccepted,
          contractAccepted: flags.contractAccepted,
          invoicePaid: flags.invoicePaid,
          projectStarted: isProductionProject(flags.projectStatus),
        }),
      );
      setRecordsLoading(false);
    }).catch(() => {
      if (active) setRecordsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [project.clientId, project.id, project.status]);

  const pageCount = brief
    ? brief.selectedPages.filter((item) => item !== "Other").length + (brief.otherPages.trim() ? 1 : 0)
    : 0;
  const featureCount = brief
    ? brief.features.filter((item) => item !== "Other").length + (brief.otherFeatures.trim() ? 1 : 0)
    : 0;
  const styles = brief
    ? [...brief.designStyles.filter((item) => item !== "Other"), brief.otherStyle.trim()].filter(Boolean)
    : [];
  const goal = brief?.goal.trim() ?? "";
  const assignedLabels = team.data
    ? Object.fromEntries(
        team.data.members.flatMap((member) =>
          member.projectAssignments
            .filter((item) => item.entityId === project.id)
            .map((item) => [member.id, item.label]),
        ),
      )
    : {};
  const assignedUserIds = team.data
    ? team.data.members
        .filter((member) => member.projectAssignments.some((item) => item.entityId === project.id))
        .map((member) => member.id)
    : [];
  const productionPath = deriveProductionPath({
    invoicePaid,
    project,
    staffAssigned: assignedUserIds.length > 0,
    awaitingReview: waiting.length > 0,
    approvedDeliverables: approvedCount,
    openFeedback: openFeedback.length,
  });

  return (
    <div className="space-y-6">
      {invoicePaid && !isProductionProject(project.status) ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            Payment received ✓
          </p>
          <h2 className="mt-1 font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
            Production ready
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            The initial production task plan is on the Tasks tab. Start production when you are ready — that sets the
            project to In Development.
          </p>
          <button
            type="button"
            className="mt-3 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("tasks")}
          >
            View tasks
          </button>
        </section>
      ) : null}

      {attention.length > 0 ? (
        <p className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3 text-sm text-[var(--admin-ink)]">
          {attention.length} deliverable{attention.length === 1 ? "" : "s"} need{attention.length === 1 ? "s" : ""} attention
        </p>
      ) : null}

      <ProjectProductionPipeline project={project} />

      <ProjectProductionPath steps={productionPath} />

      {team.data ? (
        <ProjectTeamRoster
          members={team.data.members}
          projectId={project.id}
          clientId={project.clientId}
          assignedLabels={assignedLabels}
          onChanged={() => void team.reload()}
          onOpenTasks={() => onOpenTab("tasks")}
        />
      ) : null}

      <ProjectProductionTasksCard project={project} onOpenTasks={() => onOpenTab("tasks")} />

      <ProjectDevelopmentSection
        development={project.development}
        editHref={`/admin/projects/${project.id}/edit`}
      />

      <ProjectWorkflow items={workflow} />
      <ProjectDocumentsCard
        projectId={project.id}
        clientId={project.clientId}
        proposal={proposal}
        contract={contract}
        loading={recordsLoading}
      />

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project Progress</h2>
        {counts.total === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">Add tasks to start tracking project progress.</p>
        ) : (
          <>
            <p className="mt-3 font-heading text-3xl font-semibold tracking-tight text-[var(--admin-ink)]">{progress}%</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              {counts.completed} of {counts.total} tasks completed
            </p>
            <div className="mt-4">
              <ProgressBar value={progress} />
            </div>
          </>
        )}
        {milestone ? (
          <div className="mt-5 border-t border-[var(--admin-line)] pt-4">
            <p className="text-[12px] text-[var(--admin-muted)]">Current milestone</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
                {displayMilestoneName(milestone.name)}
              </p>
              <MilestoneStatusBadge status={milestone.status} />
            </div>
            <p className="mt-2 text-sm text-[var(--admin-muted)]">
              {milestoneCounts && milestoneCounts.total > 0
                ? `${milestoneCounts.completed} of ${milestoneCounts.total} tasks in this milestone`
                : "No tasks yet. Add tasks when the project reaches this stage."}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--admin-muted)]">No milestones yet</p>
        )}
        <button
          type="button"
          className="mt-4 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
          onClick={() => onOpenTab("tasks")}
        >
          View tasks
        </button>
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project summary</h2>
          {client ? (
            <Link
              to={`/admin/clients/${client.id}`}
              className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            >
              View Full Scope
            </Link>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
            <dd className="mt-1">
              {client ? (
                <Link className="text-sm font-medium text-[var(--admin-blue)] hover:underline" to={`/admin/clients/${client.id}`}>
                  {client.businessName}
                </Link>
              ) : (
                <span className="text-sm text-[var(--admin-muted)]">Not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Type</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{project.type}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Status</dt>
            <dd className="mt-1">
              <ProjectStatusBadge status={project.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Current phase</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{milestone?.name ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Progress</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{progress}%</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Approval</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{project.approvalStatus || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Started</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{formatProjectDay(project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Target launch</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{formatProjectDay(project.targetLaunchDate)}</dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-[var(--admin-line)] pt-4">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Website Scope</p>
          {recordsLoading ? (
            <p className="mt-2 text-sm text-[var(--admin-muted)]">Loading scope…</p>
          ) : brief ? (
            <dl className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Pages</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                  {pageCount} selected
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Features</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                  {featureCount} selected
                </dd>
              </div>
              {styles.length > 0 ? (
                <div className="sm:col-span-1">
                  <dt className="text-[12px] text-[var(--admin-muted)]">Style</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{styles.join(" · ")}</dd>
                </div>
              ) : null}
              {goal ? (
                <div className="sm:col-span-3">
                  <dt className="text-[12px] text-[var(--admin-muted)]">Goal</dt>
                  <dd className="mt-1 text-sm leading-6 text-[var(--admin-ink)]">{shortenGoal(goal)}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-[var(--admin-muted)]">No Website Scope has been saved for this client yet.</p>
          )}
        </div>
      </section>

      <ProjectInvoicesCard projectId={project.id} clientId={project.clientId} />

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent activity</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("activity")}
          >
            View activity
          </button>
        </div>
        {project.activity.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No activity yet</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {project.activity.slice(0, 3).map((item) => (
              <li key={item.id}>
                <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatProjectDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent deliverables</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("files")}
          >
            View All Files
          </button>
        </div>
        {recentFiles.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No deliverables yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentFiles.map((item) => {
              const current = currentVersion(item);
              return (
                <li key={item.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                    <DeliverableStatusBadge status={item.status} />
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {item.category}
                    <span aria-hidden="true"> · </span>
                    {current ? versionLabel(current.versionNumber) : "No version"}
                    <span aria-hidden="true"> · </span>
                    {formatFileRelative(item.updatedAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Client Review</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("approvals")}
          >
            View
          </button>
        </div>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">Nothing waiting for client review.</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-[var(--admin-ink)]">
              {waiting.length} item{waiting.length === 1 ? "" : "s"} awaiting review
            </p>
            <ul className="mt-3 space-y-3">
              {waiting.slice(0, 3).map((item) => {
                const current = currentVersion(item);
                return (
                  <li key={item.id}>
                    <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                      {current ? versionLabel(current.versionNumber) : "No version"} · In Review
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Approvals</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("approvals")}
          >
            View Approvals
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--admin-ink)]">
          {approvedCount} approved · {waiting.length} awaiting review
        </p>
        <ul className="mt-3 space-y-3">
          {waiting.slice(0, 2).map((item) => {
            const current = currentVersion(item);
            return (
              <li key={item.id}>
                <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {current ? versionLabel(current.versionNumber) : "No version"} · Awaiting Review
                </p>
              </li>
            );
          })}
          {deliverables
            .filter((item) => item.status === "Approved")
            .slice(0, 2)
            .map((item) => {
              const current = currentVersion(item);
              return (
                <li key={item.id}>
                  <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {current ? versionLabel(current.versionNumber) : "No version"} · Approved
                  </p>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Feedback</h2>
          <button
            type="button"
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={() => onOpenTab("feedback")}
          >
            View Feedback
          </button>
        </div>
        {latest ? (
          <>
            <p className="mt-3 text-sm text-[var(--admin-ink)]">
              {openFeedback.length} open · {resolvedFeedback.length} resolved
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--admin-ink)]">
              {latestDeliverable?.name ?? "Deliverable"} {latestVersion ? versionLabel(latestVersion.versionNumber) : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">“{latest.message}”</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No feedback yet.</p>
        )}
      </section>
    </div>
  );
}
