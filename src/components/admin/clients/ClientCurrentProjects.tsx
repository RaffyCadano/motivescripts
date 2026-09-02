import { Link } from "react-router-dom";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { useClientProjects } from "@/components/admin/leads/LeadsProvider";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import { formatClientDate } from "@/data/agencyClients";
import { calculateProjectProgress, type AgencyProject } from "@/data/agencyProjects";
import { PRODUCTION_PROJECT_SLOT_IDS, projectTeamSlots } from "@/data/projectWorkspace";
import { assignedProjectMembers, type TeamMember } from "@/data/team";
import { displayHttpHost, safeHttpHref } from "@/lib/safeUrl";

type ClientCurrentProjectsProps = {
  clientId: string;
  createHref: string;
  canCreate: boolean;
  members?: TeamMember[];
};

export function ClientCurrentProjects({ clientId, createHref, canCreate, members = [] }: ClientCurrentProjectsProps) {
  const projects = useClientProjects(clientId);
  const title = projects.length > 1 ? "Projects" : "Current Project";

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
      {projects.length === 0 ? (
        <div className="mt-3">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No projects yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Create a project when you’re ready to begin production.
          </p>
          {canCreate ? (
            <Link to={createHref} className={`${adminPrimaryBtn} mt-4 justify-center`}>
              Create Project
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className={projects.length > 1 ? "mt-4 space-y-3" : "mt-4"}>
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectSummaryCard project={project} members={members} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectSummaryCard({ project, members }: { project: AgencyProject; members: TeamMember[] }) {
  const assigned = assignedProjectMembers(members, project.id);
  const slots = projectTeamSlots(
    members,
    project.id,
    Object.fromEntries(
      members.flatMap((member) =>
        member.projectAssignments
          .filter((item) => item.entityId === project.id)
          .map((item) => [member.id, item.label]),
      ),
    ),
  );
  const productionSlots = slots.filter((slot) => PRODUCTION_PROJECT_SLOT_IDS.has(slot.id) && slot.names.length > 0);
  const pm = slots.find((slot) => slot.id === "project_manager");
  const stagingHref = safeHttpHref(project.development.stagingUrl);
  const productionHref = safeHttpHref(project.development.productionUrl);
  const launch = project.targetLaunchDate.trim();
  const progress = calculateProjectProgress(project);

  return (
    <div className="rounded-xl border border-[var(--admin-line)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{project.name}</p>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{project.type}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {pm && pm.names.length > 0 ? (
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Project Manager</dt>
            <dd className="mt-0.5 text-[var(--admin-ink)]">{pm.names.join(", ")}</dd>
          </div>
        ) : null}
        {productionSlots.map((slot) => (
          <div key={slot.id}>
            <dt className="text-[12px] text-[var(--admin-muted)]">{slot.label}</dt>
            <dd className="mt-0.5 text-[var(--admin-ink)]">{slot.names.join(", ")}</dd>
          </div>
        ))}
        {launch ? (
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Target launch</dt>
            <dd className="mt-0.5 text-[var(--admin-ink)]">{formatClientDate(launch)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Staging</dt>
          <dd className="mt-0.5 text-[var(--admin-ink)]">
            {stagingHref ? (
              <a className="text-[var(--admin-blue)] hover:underline" href={stagingHref} target="_blank" rel="noreferrer">
                {displayHttpHost(stagingHref) || stagingHref}
              </a>
            ) : (
              <span className="text-[var(--admin-muted)]">Not available yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Production</dt>
          <dd className="mt-0.5 text-[var(--admin-ink)]">
            {productionHref ? (
              <a className="text-[var(--admin-blue)] hover:underline" href={productionHref} target="_blank" rel="noreferrer">
                {displayHttpHost(productionHref) || productionHref}
              </a>
            ) : (
              <span className="text-[var(--admin-muted)]">Not available yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Team assigned</dt>
          <dd className="mt-0.5 text-[var(--admin-ink)]">
            {assigned.length === 0
              ? "None yet"
              : `${assigned.length} team member${assigned.length === 1 ? "" : "s"} assigned`}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Progress</dt>
          <dd className="mt-0.5 text-[var(--admin-ink)]">{progress}%</dd>
        </div>
      </dl>
      <Link to={`/admin/projects/${project.id}`} className={`${adminGhostBtn} mt-4 justify-center`}>
        Open Project
      </Link>
    </div>
  );
}
