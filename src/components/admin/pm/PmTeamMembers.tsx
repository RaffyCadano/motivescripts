import type { TeamMember } from "@/data/team";

export type PmTeamMember = {
  id: string;
  fullName: string;
  jobTitle: string;
  templateLabel: string;
};

/** Members already visible to this PM via RLS (own row plus anyone sharing a client/project assignment) who work on one of `projectIds`/`clientIds`. */
export function pmTeamMembers(
  members: TeamMember[],
  currentUserId: string,
  projectIds: Set<string>,
  clientIds: Set<string>,
): PmTeamMember[] {
  return members
    .filter(
      (member) =>
        member.id !== currentUserId &&
        member.isActive &&
        (member.projectAssignments.some((item) => projectIds.has(item.entityId)) ||
          member.clientAssignments.some((item) => clientIds.has(item.entityId))),
    )
    .map((member) => ({
      id: member.id,
      fullName: member.fullName,
      jobTitle: member.jobTitle,
      templateLabel: member.templateLabel,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function PmTeamMembers({ members }: { members: PmTeamMember[] }) {
  if (members.length === 0) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-4">
      <div>
        <h2 className="font-heading text-sm font-semibold tracking-tight">Team on My Projects</h2>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">People assigned to your projects and clients.</p>
      </div>
      <ul className="mt-3 divide-y divide-[var(--admin-line)]">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{member.fullName}</p>
            <p className="text-[12px] text-[var(--admin-muted)]">{member.jobTitle.trim() || member.templateLabel}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
