import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { TeamProjectCard } from "@/components/team/TeamProjectCard";
import { useTeamWork } from "@/components/team/useTeamWork";
import { myOpenTaskCount } from "@/data/teamWorkspace";

export function TeamProjects() {
  const { profile, clientsById, myProjects, assignmentError } = useTeamWork();
  const { data } = useTeamDirectory();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">My Projects</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Projects you’re assigned to.</p>
      </div>

      {assignmentError ? <p className="text-sm text-[#b45309]">{assignmentError}</p> : null}

      {myProjects.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No projects yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">You haven’t been assigned to any projects.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {myProjects.map((project) => {
            const teammates =
              data?.members
                .filter((member) => member.projectAssignments.some((item) => item.entityId === project.id))
                .map((member) => member.fullName || member.email)
                .join(", ") ?? "";
            return (
              <TeamProjectCard
                key={project.id}
                project={project}
                clientName={clientsById.get(project.clientId)?.businessName ?? "Client"}
                assignedTaskCount={myOpenTaskCount(project, profile?.id ?? "", profile?.fullName ?? "")}
                teammates={teammates}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
