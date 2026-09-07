import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/admin/projects/TaskStatusBadge";
import { TaskAttachmentsSection } from "@/components/tasks/TaskAttachmentsSection";
import { TaskChecklistSection } from "@/components/tasks/TaskChecklistSection";
import { TaskCommentsSection } from "@/components/tasks/TaskCommentsSection";
import { TaskDeliverableSection } from "@/components/tasks/TaskDeliverableSection";
import { TaskInstructions } from "@/components/tasks/TaskInstructions";
import { formatProjectDay, taskStatuses, type AgencyTaskStatus } from "@/data/agencyProjects";
import type { AgencyDeliverable } from "@/data/files";
import { dueLabel, adminProjectHref, teamProjectHref, WIP_LIMIT, type TeamWorkTask } from "@/data/teamWorkspace";
import { isoCalendarDate } from "@/data/invoices";
import { sumHours, type TimeEntry } from "@/data/timeEntries";
import { deleteTimeEntry, listTimeEntriesForTask, logTimeEntry } from "@/data/timeEntriesRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type TeamTaskDetailProps = {
  task: TeamWorkTask;
  files: AgencyDeliverable[];
  canUpdateStatus: boolean;
  busy?: boolean;
  error?: string | null;
  workspace?: "team" | "admin";
  /** "modal" (default): floating dialog overlay, closed with the Close button/Escape/backdrop.
   *  "page": renders in-flow as a normal page section instead -- no overlay, no Close button,
   *  no focus trap/Escape handling. Pair with `breadcrumb` so there's still a way back up. */
  variant?: "modal" | "page";
  /** Rendered above the title in "page" variant only (e.g. "Projects / Website Redesign"). */
  breadcrumb?: ReactNode;
  /** Task-type-specific content (Discovery link, client-request panel, etc.), rendered after instructions. */
  extra?: ReactNode;
  /** Earlier milestones that still have open tasks -- a heads-up, never a block. Omit when the caller has no project context. */
  earlierOpen?: { name: string; openCount: number }[];
  /** How many tasks this assignee currently has In Progress (including this one, if it's already In Progress) -- a WIP-limit nudge, never a block. */
  wipCount?: number;
  onClose: () => void;
  onStatusChange: (status: AgencyTaskStatus) => void;
};

export function TeamTaskDetail({
  task,
  files,
  canUpdateStatus,
  busy,
  error,
  workspace = "team",
  variant = "modal",
  breadcrumb,
  extra,
  earlierOpen,
  wipCount,
  onClose,
  onStatusChange,
}: TeamTaskDetailProps) {
  const { profile } = useAuth();
  const displayLabel = profile?.fullName?.trim() || "Team";
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const isModal = variant === "modal";
  const projectHref = workspace === "admin" ? adminProjectHref : teamProjectHref;
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!isModal) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [isModal]);

  const header = (
    <div
      className={
        isModal
          ? "flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4"
          : "flex items-start justify-between gap-3"
      }
    >
      <div className="min-w-0">
        {!isModal && breadcrumb ? <div className="mb-2">{breadcrumb}</div> : null}
        <p className="text-[12px] font-medium text-[var(--admin-muted)]">
          {task.projectName} · {task.clientName}
        </p>
        <h2
          id={titleId}
          className={isModal ? "mt-1.5 font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]" : "mt-1.5 font-heading text-[1.5rem] font-semibold tracking-tight text-[var(--admin-ink)] md:text-[1.65rem]"}
        >
          {task.title}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <TaskStatusBadge status={task.status} />
          <TaskPriorityBadge priority={task.priority} />
          <span className="text-[12px] font-medium text-[var(--admin-muted)]">{dueLabel(task.dueDate)}</span>
        </div>
      </div>
      {isModal ? (
        <button
          ref={closeRef}
          type="button"
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] transition-colors hover:bg-[var(--admin-bg)]"
          onClick={onClose}
        >
          Close
        </button>
      ) : null}
    </div>
  );

  const body = (
    <>
      {header}
      <div className={isModal ? "min-h-0 flex-1 overflow-auto px-5 py-5" : "mt-6"}>
        <div className="space-y-4">
          <TaskInstructions title={task.title} description={task.description} className="space-y-4" />

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4 sm:p-5">
            <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Details</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {task.milestoneName ? (
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Milestone</dt>
                  <dd className="mt-1 text-sm text-[var(--admin-ink)]">{task.milestoneName}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Created</dt>
                <dd className="mt-1 text-sm text-[var(--admin-ink)]">{formatProjectDay(task.createdAt)}</dd>
              </div>
              {task.estimatedHours != null ? (
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Estimated</dt>
                  <dd className="mt-1 text-sm text-[var(--admin-ink)]">{task.estimatedHours}h</dd>
                </div>
              ) : null}
              {task.completedAt ? (
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Completed</dt>
                  <dd className="mt-1 text-sm text-[var(--admin-ink)]">{formatProjectDay(task.completedAt)}</dd>
                </div>
              ) : null}
              {task.referenceUrl ? (
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Reference link</dt>
                  <dd className="mt-1 text-sm">
                    <a
                      href={task.referenceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium text-[var(--admin-blue)] hover:underline"
                    >
                      Open link ↗
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            {canUpdateStatus ? (
              <div className="mt-4 border-t border-[var(--admin-line)] pt-4">
                <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
                  Status
                  <select
                    className="mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                    value={task.status}
                    disabled={busy}
                    onChange={(event) => onStatusChange(event.target.value as AgencyTaskStatus)}
                  >
                    {taskStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status === "Todo" ? "To Do" : status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </section>

          {earlierOpen && earlierOpen.length > 0 ? (
            <p className="rounded-lg border border-[rgb(180_83_9_/_0.3)] bg-[rgb(180_83_9_/_0.06)] px-3 py-2.5 text-[13px] text-[#b45309]">
              This task is in a later stage than {earlierOpen.map((item) => `${item.name} (${item.openCount} open)`).join(", ")}.
              Just a heads-up — you can still work on it.
            </p>
          ) : null}

          {task.status === "In Progress" && wipCount != null && wipCount > WIP_LIMIT ? (
            <p className="rounded-lg border border-[rgb(180_83_9_/_0.3)] bg-[rgb(180_83_9_/_0.06)] px-3 py-2.5 text-[13px] text-[#b45309]">
              {wipCount} tasks In Progress at once — consider finishing one before starting more. Just a nudge, not a block.
            </p>
          ) : null}

          {error ? <p className="text-sm text-[#b45309]">{error}</p> : null}

          {extra}

          <TaskDeliverableSection
            taskId={task.id}
            deliverableId={task.deliverableId}
            taskStatus={task.status}
            deliverables={files}
          />

          <TaskChecklistSection taskId={task.id} projectId={task.projectId} />

          <LogTimeSection projectId={task.projectId} taskId={task.id} estimatedHours={task.estimatedHours} viewerId={profile?.id} />

          <TaskAttachmentsSection taskId={task.id} projectId={task.projectId} uploadedByLabel={displayLabel} />

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4 sm:p-5">
            <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Related files</h3>
            {files.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">No files on this project yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {files.map((file) => (
                  <li key={file.id}>
                    <Link
                      to={projectHref(task.projectId, { tab: "files", file: file.id })}
                      className="text-sm font-medium text-[var(--admin-blue)] hover:underline"
                    >
                      {file.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <TaskCommentsSection taskId={task.id} projectId={task.projectId} authorLabel={displayLabel} />
        </div>
      </div>

      <div className={isModal ? "flex shrink-0 justify-end border-t border-[var(--admin-line)] px-5 py-4" : "mt-6 flex justify-end border-t border-[var(--admin-line)] pt-4"}>
        <Link
          to={projectHref(task.projectId, { tab: "tasks" })}
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white transition-colors hover:bg-[var(--admin-navy)]"
        >
          Open project workspace
        </Link>
      </div>
    </>
  );

  if (!isModal) {
    return (
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        {body}
      </section>
    );
  }

  return createPortal(
    <div className="admin-theme pointer-events-auto fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]"
        aria-label="Close task"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(40rem,calc(100svh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}

/** Logs against the current user via RLS (staff_id = auth.uid()). Also loads and lists
 *  this task's own entries (RLS already scopes which rows come back -- your own, plus
 *  anyone else's if you're admin or have invoices.manage on the project), so logging
 *  time isn't blind: you can see the running total against the estimate and fix mistakes. */
function LogTimeSection({
  projectId,
  taskId,
  estimatedHours,
  viewerId,
}: {
  projectId: string;
  taskId: string;
  estimatedHours?: number | null;
  viewerId?: string;
}) {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function reload() {
    try {
      setEntries(await listTimeEntriesForTask(taskId));
    } catch {
      // Non-fatal: the log-time form still works even if the list fails to load.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(hours);
    if (!hours.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter hours greater than 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await logTimeEntry({
        projectId,
        taskId,
        hours: parsed,
        note,
        entryDate: isoCalendarDate(),
      });
      setHours("");
      setNote("");
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to log time.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(entryId: string) {
    setRemovingId(entryId);
    setError(null);
    try {
      await deleteTimeEntry(entryId);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove this entry.");
    } finally {
      setRemovingId(null);
    }
  }

  const total = sumHours(entries);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Log time</h3>
        {!loading && (total > 0 || estimatedHours != null) ? (
          <p className="text-[12px] text-[var(--admin-muted)]">
            {total}h logged{estimatedHours != null ? ` of ${estimatedHours}h estimated` : ""}
          </p>
        ) : null}
      </div>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => void onSubmit(event)}>
        <label className="text-[13px] font-medium text-[var(--admin-ink)]">
          Hours <br />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={hours}
              disabled={busy}
              onChange={(event) => setHours(event.target.value)}
              className="mt-1.5 h-10 w-24 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3  text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </div>
        </label>
        <label className="min-w-[10rem] flex-1 text-[13px] font-medium text-[var(--admin-ink)]">
          Note <br />
          <div className="flex items-center gap-2"> 
            <input
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
              className="mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Logging…" : "Log time"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-[#b45309]">{error}</p> : null}

      {!loading && entries.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--admin-line)] border-t border-[var(--admin-line)]">
          {entries.map((entry) => {
            const mine = viewerId != null && entry.staffId === viewerId;
            const canRemove = mine && !entry.billedAt;
            return (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-[var(--admin-ink)]">
                    <span className="font-medium">{entry.hours}h</span> · {formatProjectDay(entry.entryDate)}
                    {!mine ? " · Teammate" : ""}
                  </p>
                  {entry.note ? <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{entry.note}</p> : null}
                </div>
                {canRemove ? (
                  <button
                    type="button"
                    disabled={removingId === entry.id}
                    onClick={() => void onRemove(entry.id)}
                    className="shrink-0 text-[12px] font-medium text-[var(--admin-muted)] hover:text-[#b45309] disabled:opacity-60"
                  >
                    {removingId === entry.id ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
