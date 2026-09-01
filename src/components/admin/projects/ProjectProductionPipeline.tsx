import { currentMilestone, milestoneProductionRows, type AgencyProject } from "@/data/agencyProjects";
import { displayMilestoneName } from "@/data/projectMilestones";
import { milestonePipelineTone } from "@/data/projectWorkspace";
import { cn } from "@/lib/cn";

export function ProjectProductionPipeline({ project }: { project: AgencyProject }) {
  const rows = milestoneProductionRows(project);
  const current = currentMilestone(project);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Production</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        Existing project milestones. This does not create a second workflow.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">Not set</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1 sm:gap-y-2">
          {rows.map((row, index) => {
            const tone = milestonePipelineTone(row.status, current?.id ?? null, row.id);
            return (
              <li key={row.id} className="flex min-w-0 items-center gap-1">
                {index > 0 ? (
                  <span className="hidden px-1 text-[var(--admin-muted)] sm:inline" aria-hidden="true">
                    →
                  </span>
                ) : null}
                <span
                  className={cn(
                    "inline-flex items-center rounded-lg px-2.5 py-1.5 font-heading text-[12px] font-semibold",
                    tone === "done" && "text-[#0f7a56]",
                    tone === "current" && "bg-[rgb(0_80_240_/_0.06)] text-[var(--admin-ink)] ring-1 ring-[rgb(0_80_240_/_0.16)]",
                    tone === "upcoming" && "text-[var(--admin-muted)]",
                  )}
                >
                  {displayMilestoneName(row.name)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
