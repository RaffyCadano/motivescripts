import { CalendarDays, Check, ChevronDown, ChevronUp, Flag, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { MilestoneStatusBadge } from "@/components/admin/projects/MilestoneStatusBadge";
import {
  formatProjectDay,
  milestoneTaskCounts,
  type AgencyMilestone,
  type AgencyProject,
} from "@/data/agencyProjects";
import { displayMilestoneName, websiteMilestonePurpose } from "@/data/projectMilestones";
import { cn } from "@/lib/cn";

type ProjectMilestonesPanelProps = {
  project: AgencyProject;
  onAdd?: () => void;
  onAddTask?: (milestone: AgencyMilestone) => void;
  onEdit?: (milestone: AgencyMilestone) => void;
  onComplete?: (milestone: AgencyMilestone) => void;
  onReopen?: (milestone: AgencyMilestone) => void;
  onHold?: (milestone: AgencyMilestone) => void;
  onMove?: (milestone: AgencyMilestone, direction: "up" | "down") => void;
  onRemove?: (milestone: AgencyMilestone) => void;
};

const ghost =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-xs font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-40";
const iconBtn =
  "flex size-8 items-center justify-center rounded-lg text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)] disabled:opacity-30 disabled:hover:bg-transparent";

/** The numbered dot on the timeline rail: a check when the stage is done, a pause when on hold. */
function StageDot({ status, number }: { status: AgencyMilestone["status"]; number: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-heading text-[12px] font-semibold",
        status === "Completed" && "border-[#0f7a56] bg-[#0f7a56] text-white",
        status === "In Progress" && "border-[var(--admin-blue)] bg-white text-[var(--admin-blue)]",
        status === "On Hold" && "border-amber-400 bg-amber-50 text-amber-700",
        status === "Not Started" && "border-[var(--admin-line)] bg-[var(--admin-bg)] text-[var(--admin-muted)]",
      )}
    >
      {status === "Completed" ? (
        <Check size={15} strokeWidth={3} />
      ) : status === "On Hold" ? (
        <Pause size={13} strokeWidth={2.6} />
      ) : (
        number
      )}
    </span>
  );
}

export function ProjectMilestonesPanel({
  project,
  onAdd,
  onAddTask,
  onEdit,
  onComplete,
  onReopen,
  onHold,
  onMove,
  onRemove,
}: ProjectMilestonesPanelProps) {
  const ordered = [...project.milestones].sort((a, b) => a.order - b.order);
  const canEdit = Boolean(onAdd && onEdit && onComplete && onReopen && onHold && onMove && onRemove);
  const doneStages = ordered.filter((milestone) => milestone.status === "Completed").length;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
            <Flag size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Milestones</h2>
            <p className="text-[12px] text-[var(--admin-muted)]">
              {ordered.length > 0
                ? `${doneStages} of ${ordered.length} stages complete`
                : "Website delivery: Discovery → Design → Development → QA & Client Review → Launch."}
            </p>
          </div>
        </div>
        {onAdd ? (
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--admin-line)] px-3.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={onAdd}
          >
            <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
            Add Milestone
          </button>
        ) : null}
      </div>
      {ordered.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-6 text-center">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No milestones yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Create milestones to organize the project.</p>
        </div>
      ) : (
        <ol className="mt-5">
          {ordered.map((milestone, index) => {
            const counts = milestoneTaskCounts(project, milestone.id, milestone.status);
            const completedWithoutTasks = counts.total === 0 && milestone.status === "Completed";
            const remaining = counts.total - counts.completed;
            const purpose = websiteMilestonePurpose(milestone.name, milestone.description);
            const name = displayMilestoneName(milestone.name);
            const last = index === ordered.length - 1;
            const done = milestone.status === "Completed";
            return (
              <li key={milestone.id} className="flex gap-3.5 sm:gap-4">
                <div className="flex flex-col items-center">
                  <StageDot status={milestone.status} number={index + 1} />
                  {!last ? (
                    <span aria-hidden="true" className={cn("w-0.5 flex-1", done ? "bg-[#0f7a56]/40" : "bg-[var(--admin-line)]")} />
                  ) : null}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] p-4",
                    done ? "bg-[var(--admin-bg)]/50" : "bg-[var(--admin-card)]",
                    !last && "mb-3",
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
                        <span className="sr-only">{String(index + 1).padStart(2, "0")} — </span>
                        {name}
                      </h3>
                      {purpose ? <p className="mt-1 text-[13px] leading-relaxed text-[var(--admin-muted)]">{purpose}</p> : null}
                    </div>
                    <div className="shrink-0 self-start">
                      <MilestoneStatusBadge status={milestone.status} />
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="text-[var(--admin-ink)]">
                        {completedWithoutTasks
                          ? "Marked complete. No tasks were tracked for this stage."
                          : counts.total === 0
                            ? "No tasks yet. Add tasks when the project reaches this stage."
                            : `${counts.completed} of ${counts.total} task${counts.total === 1 ? "" : "s"} completed · ${remaining} remaining`}
                      </span>
                      <span className="shrink-0 font-heading font-semibold text-[var(--admin-ink)]">{counts.percent}%</span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]"
                      role="progressbar"
                      aria-valuenow={counts.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${name} progress`}
                    >
                      <div
                        className={cn("h-full rounded-full", counts.percent === 100 ? "bg-[#0f7a56]" : "bg-[var(--admin-blue)]")}
                        style={{ width: `${counts.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                    <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--admin-muted)]">
                      <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
                      Due {formatProjectDay(milestone.dueDate)}
                    </p>
                    {canEdit || onAddTask ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {onAddTask ? (
                          <button type="button" className={ghost} onClick={() => onAddTask(milestone)}>
                            <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
                            Add Task
                          </button>
                        ) : null}
                        {canEdit ? (
                          <>
                            <button type="button" className={ghost} onClick={() => onEdit?.(milestone)}>
                              Edit
                            </button>
                            {done ? (
                              <button type="button" className={ghost} onClick={() => onReopen?.(milestone)}>
                                <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
                                Reopen
                              </button>
                            ) : (
                              <button type="button" className={ghost} onClick={() => onComplete?.(milestone)}>
                                <Check size={13} strokeWidth={2.4} aria-hidden="true" />
                                Complete
                              </button>
                            )}
                            {milestone.status !== "On Hold" ? (
                              <button type="button" className={ghost} onClick={() => onHold?.(milestone)}>
                                <Pause size={13} strokeWidth={2.2} aria-hidden="true" />
                                On Hold
                              </button>
                            ) : (
                              <button type="button" className={ghost} onClick={() => onReopen?.(milestone)}>
                                <Play size={13} strokeWidth={2.2} aria-hidden="true" />
                                Resume
                              </button>
                            )}
                            <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-[var(--admin-line)] sm:block" />
                            <button
                              type="button"
                              className={iconBtn}
                              title="Move up"
                              aria-label={`Move ${name} up`}
                              disabled={index === 0}
                              onClick={() => onMove?.(milestone, "up")}
                            >
                              <ChevronUp size={16} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={iconBtn}
                              title="Move down"
                              aria-label={`Move ${name} down`}
                              disabled={last}
                              onClick={() => onMove?.(milestone, "down")}
                            >
                              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={cn(iconBtn, "hover:bg-red-50 hover:text-[#b42318]")}
                              title="Remove"
                              aria-label={`Remove ${name}`}
                              onClick={() => onRemove?.(milestone)}
                            >
                              <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
