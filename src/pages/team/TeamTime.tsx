import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeamWork } from "@/components/team/useTeamWork";
import { formatProjectDay } from "@/data/agencyProjects";
import { formatUsdFromCents } from "@/data/money";
import { listPayrollPayments, listStaffPayRates } from "@/data/payrollRepository";
import { payrollMethodLabel, payrollPaymentMethods, type PayrollPayment, type PayrollPaymentMethod } from "@/data/payroll";
import { amountOwedCents, sumHours, unpaidEntries, type TimeEntry } from "@/data/timeEntries";
import { deleteTimeEntry, listMyTimeEntries, updateTimeEntry } from "@/data/timeEntriesRepository";
import { teamProjectHref } from "@/data/teamWorkspace";
import { AgencyDbError } from "@/lib/dbErrors";

export function TeamTime() {
  const { profile, myProjects } = useTeamWork();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [payRateCents, setPayRateCents] = useState<number | null>(null);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayrollPaymentMethod | "All">("All");
  const [entrySearch, setEntrySearch] = useState("");

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
      const [rows, rates, paymentRows] = await Promise.all([
        listMyTimeEntries(profile.id),
        listStaffPayRates(),
        listPayrollPayments(),
      ]);
      setEntries(rows);
      setPayRateCents(rates[0]?.payRateCents ?? null);
      setPayments(paymentRows);
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

  const weekChart = useMemo(() => {
    const now = new Date();
    const monday = mondayOf(now);
    const start = new Date(`${monday}T00:00:00`);
    const today = isoDate(now);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      const date = isoDate(day);
      return {
        date,
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        hours: sumHours(entries.filter((entry) => entry.entryDate === date)),
        isToday: date === today,
      };
    });
  }, [entries]);
  const weekChartTotal = weekChart.reduce((sum, day) => sum + day.hours, 0);
  const weekChartMax = Math.max(1, ...weekChart.map((day) => day.hours));

  const filteredPayments = useMemo(() => {
    const needle = paymentSearch.trim().toLowerCase();
    return payments.filter((payment) => {
      if (paymentMethod !== "All" && payment.method !== paymentMethod) return false;
      if (!needle) return true;
      return (
        payment.reference.toLowerCase().includes(needle) ||
        payment.notes.toLowerCase().includes(needle) ||
        formatUsdFromCents(payment.amountCents).toLowerCase().includes(needle)
      );
    });
  }, [payments, paymentSearch, paymentMethod]);
  const paymentsFiltering = paymentSearch.trim().length > 0 || paymentMethod !== "All";

  const filteredEntries = useMemo(() => {
    const needle = entrySearch.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => {
      const haystack = `${projectName(entry.projectId)} ${taskTitle(entry.taskId) ?? ""} ${entry.note}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, entrySearch, projectName, taskTitle]);

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

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">This Week</h2>
        {loading ? (
          <div className="mt-3 h-32 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
        ) : weekChartTotal === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No hours logged this week yet.</p>
        ) : (
          <div className="mt-4 flex items-end gap-2 sm:gap-4">
            {weekChart.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--admin-ink)]">{day.hours > 0 ? `${day.hours}h` : ""}</span>
                <div className="flex h-24 w-full items-end justify-center">
                  <div
                    className={
                      day.isToday
                        ? "w-full max-w-8 rounded-t-md bg-[var(--admin-blue)]"
                        : "w-full max-w-8 rounded-t-md bg-[var(--admin-navy)] opacity-70"
                    }
                    style={{ height: day.hours > 0 ? `${Math.max(6, (day.hours / weekChartMax) * 100)}%` : "2px" }}
                  />
                </div>
                <span className={day.isToday ? "text-[12px] font-semibold text-[var(--admin-blue)]" : "text-[12px] text-[var(--admin-muted)]"}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Payment history</h2>

          {payments.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-muted)]">No payments recorded yet.</p>
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={paymentSearch}
                  onChange={(event) => setPaymentSearch(event.target.value)}
                  placeholder="Search reference, notes, or amount…"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                />
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PayrollPaymentMethod | "All")}
                  className="h-9 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
                >
                  <option value="All">All methods</option>
                  {payrollPaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {payrollMethodLabel(method)}
                    </option>
                  ))}
                </select>
                {paymentsFiltering ? (
                  <button
                    type="button"
                    className="h-9 shrink-0 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                    onClick={() => {
                      setPaymentSearch("");
                      setPaymentMethod("All");
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              {filteredPayments.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--admin-muted)]">No payments match your filters.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--admin-line)] text-left text-[12px] text-[var(--admin-muted)]">
                        <th className="pb-2 pr-3 font-medium">Date</th>
                        <th className="pb-2 pr-3 font-medium">Amount</th>
                        <th className="pb-2 pr-3 font-medium">Hours</th>
                        <th className="pb-2 pr-3 font-medium">Rate</th>
                        <th className="pb-2 pr-3 font-medium">Method</th>
                        <th className="pb-2 font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--admin-line)]">
                      {filteredPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="py-2.5 pr-3 text-[var(--admin-ink)]">{formatProjectDay(payment.paymentDate)}</td>
                          <td className="py-2.5 pr-3 font-medium text-[var(--admin-ink)]">{formatUsdFromCents(payment.amountCents)}</td>
                          <td className="py-2.5 pr-3 text-[var(--admin-muted)]">{payment.hours}h</td>
                          <td className="py-2.5 pr-3 text-[var(--admin-muted)]">{formatUsdFromCents(payment.payRateCents)}/hr</td>
                          <td className="py-2.5 pr-3 text-[var(--admin-muted)]">{payrollMethodLabel(payment.method)}</td>
                          <td className="py-2.5 text-[var(--admin-muted)]">{payment.reference || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Logged time</h2>

          {loading ? (
            <div className="mt-3 h-36 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
          ) : loadError ? (
            <p className="mt-3 text-sm text-[#b45309]">{loadError}</p>
          ) : entries.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--admin-muted)]">
              No time logged yet. Log hours from a task's detail view — they'll show up here.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={entrySearch}
                  onChange={(event) => setEntrySearch(event.target.value)}
                  placeholder="Search project, task, or note…"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                />
                {entrySearch.trim() ? (
                  <button
                    type="button"
                    className="h-9 shrink-0 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                    onClick={() => setEntrySearch("")}
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>

              {rowError ? <p className="mt-3 text-sm text-[#b45309]">{rowError}</p> : null}
              {filteredEntries.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--admin-muted)]">No entries match your search.</p>
              ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-line)] text-left text-[12px] text-[var(--admin-muted)]">
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium">Project / Task</th>
                      <th className="pb-2 pr-3 font-medium">Hours</th>
                      <th className="pb-2 pr-3 font-medium">Note</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-line)]">
                    {filteredEntries.map((entry) => {
                      const editable = !entry.billedAt && !entry.payrollPaidAt;
                      const task = taskTitle(entry.taskId);
                      const editing = editingId === entry.id;

                      if (editing) {
                        return (
                          <tr key={entry.id}>
                            <td className="py-2.5 pr-3">
                              <input
                                type="date"
                                value={editDate}
                                disabled={busy}
                                onChange={(event) => setEditDate(event.target.value)}
                                className="h-9 w-full min-w-[9rem] rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                              />
                            </td>
                            <td className="py-2.5 pr-3 text-[var(--admin-muted)]">
                              {projectName(entry.projectId)}
                              {task ? ` · ${task}` : ""}
                            </td>
                            <td className="py-2.5 pr-3">
                              <input
                                type="number"
                                min="0.25"
                                step="0.25"
                                value={editHours}
                                disabled={busy}
                                onChange={(event) => setEditHours(event.target.value)}
                                className="h-9 w-20 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                              />
                            </td>
                            <td className="py-2.5 pr-3">
                              <input
                                value={editNote}
                                disabled={busy}
                                onChange={(event) => setEditNote(event.target.value)}
                                className="h-9 w-full min-w-[8rem] rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                              />
                            </td>
                            <td className="py-2.5 pr-3 text-[var(--admin-muted)]">Not yet paid</td>
                            <td className="py-2.5">
                              <div className="flex gap-2">
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
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={entry.id} className="hover:bg-[var(--admin-bg)]">
                          <td className="py-2.5 pr-3 text-[var(--admin-ink)]">{formatProjectDay(entry.entryDate)}</td>
                          <td className="py-2.5 pr-3">
                            <Link
                              to={teamProjectHref(entry.projectId, { tab: "tasks" })}
                              className="font-medium text-[var(--admin-blue)] hover:underline"
                            >
                              {projectName(entry.projectId)}
                            </Link>
                            {task ? <span className="text-[var(--admin-muted)]"> · {task}</span> : null}
                          </td>
                          <td className="py-2.5 pr-3 text-[var(--admin-ink)]">{entry.hours}h</td>
                          <td className="py-2.5 pr-3 text-[var(--admin-muted)]">{entry.note || "—"}</td>
                          <td className="py-2.5 pr-3 text-[var(--admin-muted)]">
                            {entry.payrollPaidAt ? "Paid" : "Not yet paid"}
                            {entry.billedAt ? " · Billed to client" : ""}
                          </td>
                          <td className="py-2.5">
                            <div className="flex gap-3">
                              <Link
                                to={teamProjectHref(entry.projectId, { tab: "tasks" })}
                                className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                              >
                                View project
                              </Link>
                              {editable ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-40"
                                    onClick={() => startEdit(entry)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    className="font-heading text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)] disabled:opacity-40"
                                    onClick={() => void onDelete(entry.id)}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Monday of the local calendar week containing `date`, as a date-only ISO string. */
function mondayOf(date: Date): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = start.getDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + offsetToMonday);
  return isoDate(start);
}
