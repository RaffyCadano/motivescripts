import { Link } from "react-router-dom";
import { useClientProjects } from "@/components/admin/leads/LeadsProvider";
import { PRODUCTION_PROJECT_SLOT_IDS, projectTeamSlots } from "@/data/projectWorkspace";
import type { TeamMember } from "@/data/team";

export function ClientProductionTeamSummary({
  clientId,
  members,
}: {
  clientId: string;
  members: TeamMember[];
}) {
  const projects = useClientProjects(clientId);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
        Project Production Team
      </h2>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">
        Designers, developers, content writers, and other production staff are assigned to individual projects.
      </p>
      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">
          Assign production staff after a project exists. Create the project, then open it to assign the team.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {projects.map((project) => {
            const labels = Object.fromEntries(
              members.flatMap((member) =>
                member.projectAssignments
                  .filter((item) => item.entityId === project.id)
                  .map((item) => [member.id, item.label]),
              ),
            );
            const slots = projectTeamSlots(members, project.id, labels).filter(
              (slot) => PRODUCTION_PROJECT_SLOT_IDS.has(slot.id) && slot.names.length > 0,
            );
            return (
              <li key={project.id} className="rounded-xl border border-[var(--admin-line)] px-4 py-4">
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{project.name}</p>
                {slots.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--admin-muted)]">No production staff assigned yet.</p>
                ) : (
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {slots.map((slot) => (
                      <div key={slot.id}>
                        <dt className="text-[12px] text-[var(--admin-muted)]">{slot.label}</dt>
                        <dd className="mt-0.5 text-[var(--admin-ink)]">{slot.names.join(", ")}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <Link
                  to={`/admin/projects/${project.id}`}
                  className="mt-3 inline-flex font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                >
                  Open project to assign
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
