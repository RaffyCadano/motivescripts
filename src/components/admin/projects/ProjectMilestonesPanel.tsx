import { ChevronDown, ChevronUp } from "lucide-react";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { MilestoneStatusBadge } from "@/components/admin/projects/MilestoneStatusBadge";
import {
  formatProjectDay,
  milestoneTaskCounts,
  type AgencyMilestone,
  type AgencyProject,
} from "@/data/agencyProjects";

type ProjectMilestonesPanelProps = {
  project: AgencyProject;
  onAdd: () => void;
  onEdit: (milestone: AgencyMilestone) => void;
  onComplete: (milestone: AgencyMilestone) => void;
  onReopen: (milestone: AgencyMilestone) => void;
  onHold: (milestone: AgencyMilestone) => void;
  onMove: (milestone: AgencyMilestone, direction: "up" | "down") => void;
  onRemove: (milestone: AgencyMilestone) => void;
};

export function ProjectMilestonesPanel({
  project,
  onAdd,
  onEdit,
  onComplete,
  onReopen,
  onHold,
  onMove,
  onRemove,
}: ProjectMilestonesPanelProps) {
  const ordered = [...project.milestones].sort((a, b) => a.order - b.order);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Milestones</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Organize delivery from discovery to launch.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onAdd}
        >
          Add Milestone
        </button>
      </div>
      {ordered.length === 0 ? (
        <div className="mt-4">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No milestones yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Create milestones to organize the project.</p>
        </div>
      ) : (
        <ol className="mt-5 space-y-3">
          {ordered.map((milestone, index) => {
            const counts = milestoneTaskCounts(project, milestone.id);
            return (
              <li key={milestone.id} className="rounded-xl border border-[var(--admin-line)] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-1 font-heading text-sm font-semibold text-[var(--admin-ink)]">{milestone.name}</p>
                    {milestone.description ? (
                      <p className="mt-1 text-[13px] text-[var(--admin-muted)]">{milestone.description}</p>
                    ) : null}
                  </div>
                  <MilestoneStatusBadge status={milestone.status} />
                </div>
                <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
                  {counts.total === 0
                    ? "No tasks yet"
                    : `${counts.completed} of ${counts.total} tasks completed · ${counts.percent}%`}
                </p>
                {counts.total > 0 ? (
                  <div className="mt-2">
                    <ProgressBar value={counts.percent} />
                  </div>
                ) : null}
                <p className="mt-2 text-[12px] text-[var(--admin-muted)]">Due: {formatProjectDay(milestone.dueDate)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={ghost} onClick={() => onEdit(milestone)}>
                    Edit
                  </button>
                  {milestone.status === "Completed" ? (
                    <button type="button" className={ghost} onClick={() => onReopen(milestone)}>
                      Reopen
                    </button>
                  ) : (
                    <button type="button" className={ghost} onClick={() => onComplete(milestone)}>
                      Complete
                    </button>
                  )}
                  {milestone.status !== "On Hold" ? (
                    <button type="button" className={ghost} onClick={() => onHold(milestone)}>
                      On Hold
                    </button>
                  ) : (
                    <button type="button" className={ghost} onClick={() => onReopen(milestone)}>
                      Resume
                    </button>
                  )}
                  <button
                    type="button"
                    className={ghost}
                    aria-label={`Move ${milestone.name} up`}
                    disabled={index === 0}
                    onClick={() => onMove(milestone, "up")}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    aria-label={`Move ${milestone.name} down`}
                    disabled={index === ordered.length - 1}
                    onClick={() => onMove(milestone, "down")}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" className={ghost} onClick={() => onRemove(milestone)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const ghost =
  "inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[11px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-40";
