import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { formatProjectDay, type AgencyProject } from "@/data/agencyProjects";
import { isoCalendarDate } from "@/data/invoices";
import { sumHours, unbilledEntries, type TimeEntry } from "@/data/timeEntries";
import { deleteTimeEntry, listTimeEntriesForProject, logTimeEntry } from "@/data/timeEntriesRepository";
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

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Time</h2>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        {project.billingMode === "hourly"
          ? `Hourly project at ${formatUsdFromCents(project.hourlyRateCents ?? 0)}/hr. Unbilled hours can be turned into invoice line items from an invoice's actions menu.`
          : "Fixed-fee project. Logged hours are for internal tracking only."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--admin-line)] bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Total logged</p>
          <p className="mt-1 font-heading text-lg font-semibold text-[var(--admin-ink)]">{totalHours}h</p>
        </div>
        <div className="rounded-lg border border-[var(--admin-line)] bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Unbilled</p>
          <p className="mt-1 font-heading text-lg font-semibold text-[var(--admin-ink)]">{unbilledHours}h</p>
        </div>
        {project.budgetedHours ? (
          <div className="rounded-lg border border-[var(--admin-line)] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
              Budget ({project.budgetedHours}h)
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--admin-bg)]">
              <div
                className={budgetPct !== null && budgetPct >= 100 ? "h-full bg-[#b42318]" : "h-full bg-[var(--admin-blue)]"}
                style={{ width: `${budgetPct ?? 0}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <form className="mt-5 flex flex-wrap items-end gap-3 border-t border-[var(--admin-line)] pt-4" onSubmit={(event) => void onLogTime(event)}>
        <label className="text-[13px] font-medium text-[var(--admin-ink)]">
          Hours
          <input
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            disabled={busy}
            onChange={(event) => setHours(event.target.value)}
            className="mt-1.5 h-10 w-24 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <label className="min-w-[10rem] flex-1 text-[13px] font-medium text-[var(--admin-ink)]">
          Note
          <input
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional — not tied to a specific task"
            className="mt-1.5 h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
        >
          Log time
        </button>
      </form>
      {formError ? <p className="mt-2 text-sm text-[#b45309]">{formError}</p> : null}

      <div className="mt-5 border-t border-[var(--admin-line)] pt-4">
        {loading ? (
          <p className="text-sm text-[var(--admin-muted)]">Loading time entries…</p>
        ) : loadError ? (
          <p className="text-sm text-[#b45309]">{loadError}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[var(--admin-muted)]">No time logged on this project yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--admin-line)]">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm text-[var(--admin-ink)]">
                    {staffName(entry.staffId)} — {entry.hours}h
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {formatProjectDay(entry.entryDate)}
                    {entry.billedAt ? " · Billed" : " · Unbilled"}
                  </p>
                </div>
                {!entry.billedAt ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-40"
                    onClick={() => void onDelete(entry.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
