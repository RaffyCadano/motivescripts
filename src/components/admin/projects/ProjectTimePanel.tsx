import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { formatProjectDay, type AgencyProject } from "@/data/agencyProjects";
import { isoCalendarDate } from "@/data/invoices";
import { sumHours, unbilledEntries, type TimeEntry } from "@/data/timeEntries";
import { deleteTimeEntry, listTimeEntriesForProject, logTimeEntry, updateTimeEntry } from "@/data/timeEntriesRepository";
import { formatUsdFromCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

export function ProjectTimePanel({ project }: { project: AgencyProject }) {
  const { data } = useTeamDirectory();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");

  const staffName = useMemo(() => {
    const byId = new Map((data?.members ?? []).map((member) => [member.id, member.fullName]));
    return (staffId: string) => byId.get(staffId) ?? "Former staff";
  }, [data?.members]);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listTimeEntriesForProject(project.id);
      setEntries(rows);
    } catch (caught) {
      setLoadError(caught instanceof AgencyDbError ? caught.message : "Unable to load time entries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const totalHours = sumHours(entries);
  const unbilled = unbilledEntries(entries);
  const unbilledHours = sumHours(unbilled);
  const budgetPct =
    project.budgetedHours && project.budgetedHours > 0
      ? Math.min(100, Math.round((totalHours / project.budgetedHours) * 100))
      : null;

  async function onLogTime(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(hours);
    if (!hours.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setFormError("Enter hours greater than 0.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await logTimeEntry({ projectId: project.id, taskId: null, hours: parsed, note, entryDate: isoCalendarDate() });
      setHours("");
      setNote("");
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to log time.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteTimeEntry(id);
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this entry.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditHours(String(entry.hours));
    setEditNote(entry.note);
    setEditDate(entry.entryDate);
    setFormError(null);
  }

  async function onSaveEdit(id: string) {
    const parsed = Number(editHours);
    if (!editHours.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setFormError("Enter hours greater than 0.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await updateTimeEntry(id, { hours: parsed, note: editNote, entryDate: editDate });
      setEditingId(null);
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to update this entry.");
    } finally {
      setBusy(false);
    }
  }

  const hourly = project.billingMode === "hourly";
  const overBudget = budgetPct !== null && budgetPct >= 100;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
            <Clock3 size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Time</h2>
            <p className="text-[12px] text-[var(--admin-muted)]">
              {hourly
                ? "Unbilled hours can be turned into invoice line items from an invoice's actions menu."
                : "Logged hours are for internal tracking only."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-[var(--admin-bg)] px-2.5 py-1 font-heading text-xs font-semibold text-[var(--admin-ink)]">
          {hourly ? `Hourly · ${formatUsdFromCents(project.hourlyRateCents ?? 0)}/hr` : "Fixed fee"}
        </span>
      </div>

      <div className={project.budgetedHours ? "mt-4 grid gap-3 sm:grid-cols-3" : "mt-4 grid gap-3 sm:grid-cols-2"}>
        <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-3">
          <p className="text-[12px] text-[var(--admin-muted)]">Total logged</p>
          <p className="mt-0.5 font-heading text-2xl font-semibold text-[var(--admin-ink)]">{totalHours}h</p>
        </div>
        <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-3">
          <p className="text-[12px] text-[var(--admin-muted)]">Unbilled</p>
          <p className="mt-0.5 font-heading text-2xl font-semibold text-[var(--admin-ink)]">{unbilledHours}h</p>
        </div>
        {project.budgetedHours ? (
          <div className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-3">
            <p className="text-[12px] text-[var(--admin-muted)]">Budget</p>
            <p className="mt-0.5 font-heading text-2xl font-semibold text-[var(--admin-ink)]">
              {totalHours}
              <span className="text-sm font-medium text-[var(--admin-muted)]"> / {project.budgetedHours}h</span>
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-line)]"
              role="progressbar"
              aria-valuenow={budgetPct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Budget used"
            >
              <div className={overBudget ? "h-full bg-[#b42318]" : "h-full bg-[var(--admin-blue)]"} style={{ width: `${budgetPct ?? 0}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      <form
        className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4"
        onSubmit={(event) => void onLogTime(event)}
      >
        <label className="flex flex-col text-[13px] font-medium text-[var(--admin-ink)]">
          Hours
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            disabled={busy}
            onChange={(event) => setHours(event.target.value)}
            className="mt-1.5 h-10 w-24 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col text-[13px] font-medium text-[var(--admin-ink)]">
          <span>Note <span className="font-normal text-[var(--admin-muted)]">(optional)</span></span>
          <input
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What you worked on. Not tied to a specific task."
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          Log time
        </button>
      </form>
      {formError ? <p className="mt-2 text-sm text-[#b45309]">{formError}</p> : null}

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">Loading time entries…</p>
        ) : loadError ? (
          <p className="text-sm text-[#b45309]">{loadError}</p>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--admin-line)] px-4 py-8 text-center">
            <Clock3 size={22} strokeWidth={1.8} className="mx-auto text-[var(--admin-muted)]" aria-hidden="true" />
            <p className="mt-2 font-heading text-sm font-semibold text-[var(--admin-ink)]">No time logged yet</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Log your first hours above to start tracking time on this project.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--admin-line)]">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--admin-bg)] text-left text-[12px] text-[var(--admin-muted)]">
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Staff</th>
                  <th className="px-3 py-2.5 font-medium">Hours</th>
                  <th className="px-3 py-2.5 font-medium">Note</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-line)]">
                {entries.map((entry) =>
                  editingId === entry.id ? (
                    <tr key={entry.id} className="bg-[rgb(0_80_240_/_0.03)]">
                      <td className="px-3 py-2.5">
                        <input
                          type="date"
                          aria-label="Date"
                          value={editDate}
                          disabled={busy}
                          onChange={(event) => setEditDate(event.target.value)}
                          className="h-9 w-full min-w-[9rem] rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[var(--admin-muted)]">{staffName(entry.staffId)}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          aria-label="Hours"
                          min="0.25"
                          step="0.25"
                          value={editHours}
                          disabled={busy}
                          onChange={(event) => setEditHours(event.target.value)}
                          className="h-9 w-20 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          aria-label="Note"
                          value={editNote}
                          disabled={busy}
                          onChange={(event) => setEditNote(event.target.value)}
                          className="h-9 w-full min-w-[8rem] rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[var(--admin-muted)]">Unbilled</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-60"
                            onClick={() => void onSaveEdit(entry.id)}
                          >
                            <Check size={13} strokeWidth={2.6} aria-hidden="true" />
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
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={entry.id} className="hover:bg-[var(--admin-bg)]">
                      <td className="px-3 py-3 text-[var(--admin-ink)]">{formatProjectDay(entry.entryDate)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2 text-[var(--admin-ink)]">
                          <span
                            aria-hidden="true"
                            className="flex size-6 items-center justify-center rounded-full bg-[rgb(0_80_240_/_0.1)] font-heading text-[10px] font-semibold text-[var(--admin-blue)]"
                          >
                            {staffName(entry.staffId).split(/\s+/).map((part) => part[0] ?? "").slice(0, 2).join("").toUpperCase() || "?"}
                          </span>
                          {staffName(entry.staffId)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-[var(--admin-ink)]">{entry.hours}h</td>
                      <td className="px-3 py-3 text-[var(--admin-muted)]">{entry.note || "—"}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            entry.billedAt
                              ? "inline-flex rounded-full bg-[rgb(16_185_129_/_0.1)] px-2.5 py-0.5 font-heading text-[12px] font-semibold text-[#0f7a56]"
                              : "inline-flex rounded-full bg-[var(--admin-bg)] px-2.5 py-0.5 font-heading text-[12px] font-semibold text-[var(--admin-muted)]"
                          }
                        >
                          {entry.billedAt ? "Billed" : "Unbilled"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {!entry.billedAt ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              aria-label={`Edit the ${entry.hours}h entry on ${formatProjectDay(entry.entryDate)}`}
                              title="Edit"
                              className="flex size-8 items-center justify-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-blue)] disabled:opacity-40"
                              onClick={() => startEdit(entry)}
                            >
                              <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              aria-label={`Delete the ${entry.hours}h entry on ${formatProjectDay(entry.entryDate)}`}
                              title="Delete"
                              className="flex size-8 items-center justify-center rounded-md text-[var(--admin-muted)] hover:bg-red-50 hover:text-[#b42318] disabled:opacity-40"
                              onClick={() => void onDelete(entry.id)}
                            >
                              <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
