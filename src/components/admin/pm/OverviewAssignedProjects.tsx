import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { currentMilestone, formatProjectDay } from "@/data/agencyProjects";
import type { DiscoveryIntake } from "@/data/discoveryIntake";
import { displayMilestoneName } from "@/data/projectMilestones";
import { pmProjectProgress, projectCoordinationHint } from "@/data/pmOverview";
import { adminProjectHref, isTaskOverdue, type TeamWorkTask } from "@/data/teamWorkspace";
import type { AgencyProject } from "@/data/agencyProjects";

type OverviewAssignedProjectsProps = {
  projects: AgencyProject[];
  clientsById: Map<string, { businessName: string }>;
  tasks: TeamWorkTask[];
  intakesByProject: Map<string, DiscoveryIntake>;
  deliverables: { id: string; projectId: string; status: string }[];
  feedbackCountByProject: Map<string, number>;
};

export function OverviewAssignedProjects({
  projects,
  clientsById,
  tasks,
  intakesByProject,
  deliverables,
  feedbackCountByProject,
}: OverviewAssignedProjectsProps) {
  const rows = projects.filter((project) => !project.archived);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">My Projects</h2>
        <Link className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline" to="/admin/projects">
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--admin-muted)]">No projects assigned to you yet.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                <tr>
                  <th className="px-4 py-3 font-heading">Project</th>
                  <th className="px-4 py-3 font-heading">Status</th>
                  <th className="px-4 py-3 font-heading">Phase</th>
                  <th className="px-4 py-3 font-heading">Progress</th>
                  <th className="px-4 py-3 font-heading">Next action</th>
                  <th className="px-4 py-3 font-heading">Due</th>
                  <th className="px-4 py-3 font-heading" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-line)]">
                {rows.map((project) => (
                  <AssignedProjectRow
                    key={project.id}
                    project={project}
                    clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                    tasks={tasks}
                    intake={intakesByProject.get(project.id) ?? null}
                    deliverables={deliverables}
                    openFeedbackCount={feedbackCountByProject.get(project.id) ?? 0}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-[var(--admin-line)] md:hidden">
            {rows.map((project) => (
              <AssignedProjectCard
                key={project.id}
                project={project}
                clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                tasks={tasks}
                intake={intakesByProject.get(project.id) ?? null}
                deliverables={deliverables}
                openFeedbackCount={feedbackCountByProject.get(project.id) ?? 0}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function projectSignals(
  project: AgencyProject,
  tasks: TeamWorkTask[],
  intake: DiscoveryIntake | null,
  deliverables: { id: string; projectId: string; status: string }[],
  openFeedbackCount: number,
) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const overdueTaskCount = projectTasks.filter(isTaskOverdue).length;
  const projectDeliverables = deliverables.filter((item) => item.projectId === project.id);

  return {
    overdueTaskCount,
    deliverableNeedsChanges: projectDeliverables.some((item) => item.status === "Needs Changes"),
    deliverableInReview: projectDeliverables.some((item) => item.status === "In Review"),
    openFeedbackCount,
    nextAction: projectCoordinationHint({
      project,
      intake,
      overdueTaskCount,
      deliverableNeedsChanges: projectDeliverables.some((item) => item.status === "Needs Changes"),
      deliverableInReview: projectDeliverables.some((item) => item.status === "In Review"),
      openFeedbackCount,
    }),
  };
}

function AssignedProjectRow({
  project,
  clientName,
  tasks,
  intake,
  deliverables,
  openFeedbackCount,
}: {
  project: AgencyProject;
  clientName: string;
  tasks: TeamWorkTask[];
  intake: DiscoveryIntake | null;
  deliverables: { id: string; projectId: string; status: string }[];
  openFeedbackCount: number;
}) {
  const milestone = currentMilestone(project);
  const { nextAction } = projectSignals(project, tasks, intake, deliverables, openFeedbackCount);

  return (
    <tr className="hover:bg-[var(--admin-bg)]">
      <td className="px-4 py-3">
        <Link to={adminProjectHref(project.id)} className="font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)]">
          {project.name}
        </Link>
        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{clientName}</p>
      </td>
      <td className="px-4 py-3">
        <ProjectStatusBadge status={project.status} />
      </td>
      <td className="px-4 py-3 text-[var(--admin-muted)]">
        {milestone ? displayMilestoneName(milestone.name) : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="w-28">
          <ProgressBar value={pmProjectProgress(project)} />
        </div>
      </td>
      <td className="max-w-xs px-4 py-3 text-[12px] text-[var(--admin-muted)]">{nextAction}</td>
      <td className="px-4 py-3 text-[12px] text-[var(--admin-muted)]">{formatProjectDay(project.targetLaunchDate)}</td>
      <td className="px-4 py-3 text-right">
        <Link to={adminProjectHref(project.id)} className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
          Open Project
        </Link>
      </td>
    </tr>
  );
}

function AssignedProjectCard({
  project,
  clientName,
  tasks,
  intake,
  deliverables,
  openFeedbackCount,
}: {
  project: AgencyProject;
  clientName: string;
  tasks: TeamWorkTask[];
  intake: DiscoveryIntake | null;
  deliverables: { id: string; projectId: string; status: string }[];
  openFeedbackCount: number;
}) {
  const milestone = currentMilestone(project);
  const { nextAction } = projectSignals(project, tasks, intake, deliverables, openFeedbackCount);

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={adminProjectHref(project.id)} className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]">
            {project.name}
          </Link>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{clientName}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <p className="text-[12px] text-[var(--admin-muted)]">
        {milestone ? displayMilestoneName(milestone.name) : "No milestone"} · Launch {formatProjectDay(project.targetLaunchDate)}
      </p>
      <ProgressBar value={pmProjectProgress(project)} label="Progress" />
      <p className="text-[12px] text-[var(--admin-muted)]">{nextAction}</p>
      <Link to={adminProjectHref(project.id)} className="inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
        Open Project
      </Link>
    </li>
  );
}
