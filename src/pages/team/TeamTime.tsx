import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeamWork } from "@/components/team/useTeamWork";
import { formatProjectDay } from "@/data/agencyProjects";
import { formatUsdFromCents } from "@/data/money";
import { listStaffPayRates } from "@/data/payrollRepository";
import { amountOwedCents, sumHours, unpaidEntries, type TimeEntry } from "@/data/timeEntries";
import { deleteTimeEntry, listMyTimeEntries, updateTimeEntry } from "@/data/timeEntriesRepository";
import { teamProjectHref } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";

export function TeamTime() {
  const { profile, myProjects } = useTeamWork();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [payRateCents, setPayRateCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const projectName = useMemo(() => {
    const byId = new Map(myProjects.map((project) => [project.id, project.name]));
    return (id: string) => byId.get(id) ?? "Project";
  }, [myProjects]);

  const taskTitle = useMemo(() => {
    const byId = new Map<string, string>();
    for (const project of myProjects) {
      for (const task of project.tasks) byId.set(task.id, task.title);
    }
    return (id: string | null) => (id ? (byId.get(id) ?? null) : null);
  }, [myProjects]);

  async function reload() {
    if (!profile?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, rates] = await Promise.all([listMyTimeEntries(profile.id), listStaffPayRates()]);
      setEntries(rows);
      setPayRateCents(rates[0]?.payRateCents ?? null);
    } catch (caught) {
      setLoadError(caught instanceof AgencyDbError ? caught.message : "Unable to load your time entries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const totalHours = sumHours(entries);
  const unpaidHours = sumHours(unpaidEntries(entries));
  const estimatedOwedCents = payRateCents != null ? amountOwedCents(entries, payRateCents) : null;

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditHours(String(entry.hours));
    setEditNote(entry.note);
    setEditDate(entry.entryDate);
    setRowError(null);
  }

  async function onSaveEdit(id: string) {
    const parsed = Number(editHours);
    if (!editHours.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setRowError("Enter hours greater than 0.");
      return;
    }
    setBusy(true);
    setRowError(null);
    try {
      await updateTimeEntry(id, { hours: parsed, note: editNote, entryDate: editDate });
      setEditingId(null);
      await reload();
    } catch (caught) {
      setRowError(caught instanceof AgencyDbError ? caught.message : "Unable to update this entry.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    setRowError(null);
    try {
      await deleteTimeEntry(id);
      await reload();
    } catch (caught) {
      setRowError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">My Time</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Hours you've logged across your assigned projects.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
          <p className="text-[12px] text-[var(--admin-muted)]">Total logged</p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">{totalHours}h</p>
        </article>
        <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
          <p className="text-[12px] text-[var(--admin-muted)]">Not yet paid</p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">{unpaidHours}h</p>
        </article>
        {estimatedOwedCents != null ? (
          <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
            <p className="text-[12px] text-[var(--admin-muted)]">Estimated amount owed</p>
            <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">{formatUsdFromCents(estimatedOwedCents)}</p>
            <p className="mt-1 text-[11px] text-[var(--admin-muted)]">Unpaid hours × your hourly rate. Not an official statement.</p>
          </article>
        ) : null}
      </section>

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : loadError ? (
        <p className="text-sm text-[#b45309]">{loadError}</p>
      ) : entries.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No time logged yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Log hours from a task's detail view — they'll show up here.
          </p>
        </div>
      ) : (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          {rowError ? <p className="mb-3 text-sm text-[#b45309]">{rowError}</p> : null}
          <ul className="divide-y divide-[var(--admin-line)]">
            {entries.map((entry) => {
              const editable = !entry.billedAt && !entry.payrollPaidAt;
              const task = taskTitle(entry.taskId);
              if (editingId === entry.id) {
                return (
                  <li key={entry.id} className="flex flex-wrap items-end gap-2 py-3">
                    <label className="text-[12px] font-medium text-[var(--admin-ink)]">
                      Hours
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={editHours}
                        disabled={busy}
                        onChange={(event) => setEditHours(event.target.value)}
                        className="mt-1 h-9 w-20 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                      />
                    </label>
                    <label className="min-w-[8rem] flex-1 text-[12px] font-medium text-[var(--admin-ink)]">
                      Note
                      <input
                        value={editNote}
                        disabled={busy}
                        onChange={(event) => setEditNote(event.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                      />
                    </label>
                    <label className="text-[12px] font-medium text-[var(--admin-ink)]">
                      Date
                      <input
                        type="date"
                        value={editDate}
                        disabled={busy}
                        onChange={(event) => setEditDate(event.target.value)}
                        className="mt-1 h-9 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-60"
                      onClick={() => void onSaveEdit(entry.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </li>
                );
              }
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--admin-ink)]">
                      <Link to={teamProjectHref(entry.projectId, { tab: "tasks" })} className="font-medium text-[var(--admin-blue)] hover:underline">
                        {projectName(entry.projectId)}
                      </Link>
                      {task ? ` · ${task}` : ""} — {entry.hours}h
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                      {formatProjectDay(entry.entryDate)} · {entry.payrollPaidAt ? "Paid" : "Not yet paid"}
                      {entry.billedAt ? " · Billed to client" : ""}
                    </p>
                  </div>
                  {editable ? (
                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        className="text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-40"
                        onClick={() => startEdit(entry)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-40"
                        onClick={() => void onDelete(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
