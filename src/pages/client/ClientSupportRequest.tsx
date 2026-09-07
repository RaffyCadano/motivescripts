import { useState, type FormEvent } from "react";
import { usePortalSession, useLeads } from "@/components/admin/leads/LeadsProvider";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { taskStatusLabel, type AgencyTaskStatus } from "@/data/agencyProjects";
import { formatClientDate } from "@/data/agencyClients";
import { AgencyDbError } from "@/lib/dbErrors";

const statusTone: Record<AgencyTaskStatus, "progress" | "review" | "done" | "changes" | "neutral"> = {
  Todo: "neutral",
  "In Progress": "progress",
  "In Review": "review",
  Completed: "done",
  Blocked: "changes",
};

export function ClientSupportRequest() {
  const { project } = usePortalSession();
  const { addClientTask } = useLeads();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitted = (project?.tasks ?? [])
    .filter((task) => task.origin === "client")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !project || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addClientTask(project.id, title, description);
      setTitle("");
      setDescription("");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to submit this request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Support</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--client-muted)]">
          Report an issue with your site or request something new. This creates a task your project team will triage.
        </p>
      </header>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">New request</h2>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">What's the issue?</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              placeholder="e.g. Contact form isn't sending emails"
              className="mt-2 w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          <label className="block">
            <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">
              Details <span className="font-normal text-[var(--client-muted)]">Optional</span>
            </span>
            <textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Anything that helps us understand and reproduce the issue."
              className="mt-2 w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !project || !title.trim()}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      </section>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Your requests</h2>
        {submitted.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">You haven't submitted any requests yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {submitted.map((task) => (
              <li key={task.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">{task.title}</p>
                  <ClientStatusBadge label={taskStatusLabel(task.status)} tone={statusTone[task.status]} />
                </div>
                {task.description ? (
                  <p className="mt-1 text-sm text-[var(--client-ink)]">{task.description}</p>
                ) : null}
                <p className="mt-1 text-[12px] text-[var(--client-muted)]">Submitted {formatClientDate(task.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
