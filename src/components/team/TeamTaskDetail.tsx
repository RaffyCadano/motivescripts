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
import { dueLabel, adminProjectHref, teamProjectHref, type TeamWorkTask } from "@/data/teamWorkspace";
import { isoCalendarDate } from "@/data/invoices";
import { logTimeEntry } from "@/data/timeEntriesRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type TeamTaskDetailProps = {
  task: TeamWorkTask;
  files: AgencyDeliverable[];
  canUpdateStatus: boolean;
  busy?: boolean;
  error?: string | null;
  workspace?: "team" | "admin";
  /** Task-type-specific content (Discovery link, client-request panel, etc.), rendered after instructions. */
  extra?: ReactNode;
  /** Earlier milestones that still have open tasks -- a heads-up, never a block. Omit when the caller has no project context. */
  earlierOpen?: { name: string; openCount: number }[];
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
  extra,
  earlierOpen,
  onClose,
  onStatusChange,
}: TeamTaskDetailProps) {
  const { profile } = useAuth();
  const displayLabel = profile?.fullName?.trim() || "Team";
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const projectHref = workspace === "admin" ? adminProjectHref : teamProjectHref;
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
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
  }, []);

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
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] text-[var(--admin-muted)]">{task.clientName}</p>
            <h2 id={titleId} className="mt-1 font-heading text-lg font-semibold text-[var(--admin-ink)]">
              {task.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              <span className="text-[12px] text-[var(--admin-muted)]">{dueLabel(task.dueDate)}</span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <TaskInstructions title={task.title} description={task.description} className="space-y-4" />

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Project</dt>
              <dd className="mt-1 text-sm">{task.projectName}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
              <dd className="mt-1 text-sm">{task.clientName}</dd>
            </div>
            {task.milestoneName ? (
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Milestone</dt>
                <dd className="mt-1 text-sm">{task.milestoneName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[12px] text-[var(--admin-muted)]">Created</dt>
              <dd className="mt-1 text-sm">{formatProjectDay(task.createdAt)}</dd>
            </div>
            {task.estimatedHours != null ? (
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Estimated</dt>
                <dd className="mt-1 text-sm">{task.estimatedHours}h</dd>
              </div>
            ) : null}
            {task.completedAt ? (
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Completed</dt>
                <dd className="mt-1 text-sm">{formatProjectDay(task.completedAt)}</dd>
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
            <label className="mt-5 block text-[13px] font-medium text-[var(--admin-ink)]">
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
          ) : null}

          {earlierOpen && earlierOpen.length > 0 ? (
            <p className="mt-3 rounded-lg border border-[rgb(180_83_9_/_0.3)] bg-[rgb(180_83_9_/_0.06)] px-3 py-2.5 text-[13px] text-[#b45309]">
              This task is in a later stage than {earlierOpen.map((item) => `${item.name} (${item.openCount} open)`).join(", ")}.
              Just a heads-up — you can still work on it.
            </p>
          ) : null}

          {error ? <p className="mt-3 text-sm text-[#b45309]">{error}</p> : null}

          {extra ? <div className="mt-6">{extra}</div> : null}

          <TaskDeliverableSection
            taskId={task.id}
            deliverableId={task.deliverableId}
            taskStatus={task.status}
            deliverables={files}
          />

          <TaskChecklistSection taskId={task.id} projectId={task.projectId} />

          <LogTimeSection projectId={task.projectId} taskId={task.id} />

          <TaskAttachmentsSection taskId={task.id} projectId={task.projectId} uploadedByLabel={displayLabel} />

          <section className="mt-6">
            <h3 className="font-heading text-sm font-semibold">Related files</h3>
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

        <div className="shrink-0 border-t border-[var(--admin-line)] px-5 py-4">
          <Link
            to={projectHref(task.projectId, { tab: "tasks" })}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white"
          >
            Open project workspace
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Self-contained: logs against the current user via RLS (staff_id = auth.uid()), so no identity is passed in. */
function LogTimeSection({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);

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
      setLogged(true);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to log time.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <h3 className="font-heading text-sm font-semibold">Log time</h3>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => void onSubmit(event)}>
        <label className="text-[13px] font-medium text-[var(--admin-ink)]">
          Hours
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            disabled={busy}
            onChange={(event) => {
              setHours(event.target.value);
              setLogged(false);
            }}
            className="mt-1.5 h-10 w-24 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="min-w-[10rem] flex-1 text-[13px] font-medium text-[var(--admin-ink)]">
          Note
          <input
            value={note}
            disabled={busy}
            onChange={(event) => {
              setNote(event.target.value);
              setLogged(false);
            }}
            placeholder="Optional"
            className="mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
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
      {logged ? <p className="mt-2 text-sm text-[#0f7a56]">Time logged for today.</p> : null}
    </section>
  );
}
