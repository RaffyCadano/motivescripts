import type { AgencyProject } from "@/data/agencyProjects";
import type { TeamMember } from "@/data/team";

export type PmTeamMember = {
  id: string;
  fullName: string;
  jobTitle: string;
  templateLabel: string;
  openTaskCount: number;
  inProgressCount: number;
};

/**
 * Members already visible to this PM via RLS (own row plus anyone sharing a client/project
 * assignment) who work on one of `projectIds`/`clientIds`. Task counts are real, scoped to
 * this PM's own projects only -- never a fabricated utilization/availability percentage.
 */
export function pmTeamMembers(
  members: TeamMember[],
  currentUserId: string,
  projectIds: Set<string>,
  clientIds: Set<string>,
  projects: AgencyProject[],
): PmTeamMember[] {
  const scopedTasks = projects
    .filter((project) => projectIds.has(project.id) && !project.archived)
    .flatMap((project) => project.tasks);

  return members
    .filter(
      (member) =>
        member.id !== currentUserId &&
        member.isActive &&
        (member.projectAssignments.some((item) => projectIds.has(item.entityId)) ||
          member.clientAssignments.some((item) => clientIds.has(item.entityId))),
    )
    .map((member) => {
      const memberTasks = scopedTasks.filter((task) => task.assignedTo === member.id && task.status !== "Completed");
      return {
        id: member.id,
        fullName: member.fullName,
        jobTitle: member.jobTitle,
        templateLabel: member.templateLabel,
        openTaskCount: memberTasks.length,
        inProgressCount: memberTasks.filter((task) => task.status === "In Progress").length,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function PmTeamMembers({ members }: { members: PmTeamMember[] }) {
  if (members.length === 0) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-4">
      <div>
        <h2 className="font-heading text-sm font-semibold tracking-tight">Team on My Projects</h2>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          People assigned to your projects and clients, and their open work on those projects.
        </p>
      </div>
      <ul className="mt-3 divide-y divide-[var(--admin-line)]">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{member.fullName}</p>
              <p className="text-[12px] text-[var(--admin-muted)]">{member.jobTitle.trim() || member.templateLabel}</p>
            </div>
            <p className="shrink-0 text-[12px] text-[var(--admin-muted)]">
              {member.openTaskCount === 0
                ? "No open tasks"
                : `${member.openTaskCount} open task${member.openTaskCount === 1 ? "" : "s"}${
                    member.inProgressCount > 0 ? ` · ${member.inProgressCount} in progress` : ""
                  }`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
