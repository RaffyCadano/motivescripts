import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { RecordPayrollPaymentModal } from "@/components/admin/payroll/RecordPayrollPaymentModal";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { sumHours, unpaidEntries, unpaidHoursByProject, type TimeEntry } from "@/data/timeEntries";
import { listMyTimeEntries } from "@/data/timeEntriesRepository";
import {
  listStaffPayRates,
  listStaffProjectPayRates,
  markTimeEntriesPaid,
  removeStaffProjectPayRate,
  setStaffPayRate,
  setStaffProjectPayRate,
} from "@/data/payrollRepository";
import { projectPayBreakdown, type PayrollPaymentMethod, type StaffPayRate, type StaffProjectPayRate } from "@/data/payroll";
import { centsInputValue, formatUsdFromCents, parseDollarsToCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

function projectRateKey(staffId: string, projectId: string): string {
  return `${staffId}:${projectId}`;
}

export function AdminPayroll() {
  const { profile } = useAuth();
  const isAdmin = isActiveAdmin(profile);
  const { data } = useTeamDirectory();
  const { projects } = useLeads();
  const [rates, setRates] = useState<Map<string, StaffPayRate>>(new Map());
  const [projectRates, setProjectRates] = useState<Map<string, StaffProjectPayRate>>(new Map());
  const [entriesByStaff, setEntriesByStaff] = useState<Map<string, TimeEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rateDrafts, setRateDrafts] = useState<Map<string, string>>(new Map());
  const [zelleDrafts, setZelleDrafts] = useState<Map<string, string>>(new Map());
  const [paypalDrafts, setPaypalDrafts] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Map<string, string>>(new Map());
  const [payModalFor, setPayModalFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All");
  const [payStatus, setPayStatus] = useState<"All" | "unpaid" | "paid" | "no-rate">("All");
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [projectRateDrafts, setProjectRateDrafts] = useState<Map<string, string>>(new Map());
  const [projectRowError, setProjectRowError] = useState<Map<string, string>>(new Map());
  const [projectPayModal, setProjectPayModal] = useState<{ staffId: string; projectId: string } | null>(null);

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);

  const members = useMemo(() => (data?.members ?? []).filter((member) => member.isActive), [data?.members]);
  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (needle && !`${member.fullName} ${member.jobTitle} ${member.templateLabel}`.toLowerCase().includes(needle)) {
        return false;
      }
      if (role !== "All" && member.templateKey !== role) return false;
      if (payStatus !== "All") {
        const rate = rates.get(member.id);
        const entries = entriesByStaff.get(member.id) ?? [];
        const unpaidHours = sumHours(unpaidEntries(entries));
        if (payStatus === "no-rate") return !rate;
        if (payStatus === "unpaid") return unpaidHours > 0;
        if (payStatus === "paid") return Boolean(rate) && unpaidHours <= 0;
      }
      return true;
    });
  }, [members, query, role, payStatus, rates, entriesByStaff]);

  async function reload() {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const rateRows = await listStaffPayRates();
      setRates(new Map(rateRows.map((row) => [row.userId, row])));
      const projectRateRows = await listStaffProjectPayRates();
      setProjectRates(new Map(projectRateRows.map((row) => [projectRateKey(row.staffId, row.projectId), row])));
      const entryLists = await Promise.all(members.map((member) => listMyTimeEntries(member.id)));
      setEntriesByStaff(new Map(members.map((member, index) => [member.id, entryLists[index]])));
    } catch (caught) {
      setLoadError(caught instanceof AgencyDbError ? caught.message : "Unable to load payroll data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, members.length]);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Payroll</h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--admin-muted)]">You don’t have access to this section.</p>
        <div className="mt-8 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10 text-sm text-[var(--admin-muted)]">
          Pay rates and payroll are visible to administrators only.
        </div>
      </div>
    );
  }

  async function onSaveRate(userId: string) {
    const draft = rateDrafts.get(userId) ?? "";
    const cents = parseDollarsToCents(draft);
    if (cents === null || cents < 0) {
      setRowError((current) => new Map(current).set(userId, "Enter a valid pay rate."));
      return;
    }
    const rate = rates.get(userId);
    const zelleContact = zelleDrafts.has(userId) ? zelleDrafts.get(userId)! : rate?.zelleContact ?? "";
    const paypalEmail = paypalDrafts.has(userId) ? paypalDrafts.get(userId)! : rate?.paypalEmail ?? "";
    setBusyId(userId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(userId);
      return next;
    });
    try {
      await setStaffPayRate(userId, cents, { zelleContact, paypalEmail });
      await reload();
      setRateDrafts((current) => {
        const next = new Map(current);
        next.delete(userId);
        return next;
      });
      setZelleDrafts((current) => {
        const next = new Map(current);
        next.delete(userId);
        return next;
      });
      setPaypalDrafts((current) => {
        const next = new Map(current);
        next.delete(userId);
        return next;
      });
    } catch (caught) {
      setRowError((current) =>
        new Map(current).set(userId, caught instanceof AgencyDbError ? caught.message : "Unable to save this rate."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onRecordPayment(
    userId: string,
    input: { method: PayrollPaymentMethod; reference: string; notes: string },
  ) {
    setBusyId(userId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(userId);
      return next;
    });
    try {
      await markTimeEntriesPaid(userId, input);
      setPayModalFor(null);
      await reload();
    } catch (caught) {
      setRowError((current) =>
        new Map(current).set(userId, caught instanceof AgencyDbError ? caught.message : "Unable to record this payment."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveProjectRate(staffId: string, projectId: string) {
    const key = projectRateKey(staffId, projectId);
    const draft = projectRateDrafts.get(key) ?? "";
    const cents = parseDollarsToCents(draft);
    if (cents === null || cents < 0) {
      setProjectRowError((current) => new Map(current).set(key, "Enter a valid pay rate."));
      return;
    }
    setBusyId(key);
    setProjectRowError((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    try {
      await setStaffProjectPayRate(staffId, projectId, cents);
      await reload();
      setProjectRateDrafts((current) => {
        const next = new Map(current);
        next.delete(key);
        return next;
      });
    } catch (caught) {
      setProjectRowError((current) =>
        new Map(current).set(key, caught instanceof AgencyDbError ? caught.message : "Unable to save this rate."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveProjectRate(staffId: string, projectId: string) {
    const key = projectRateKey(staffId, projectId);
    setBusyId(key);
    setProjectRowError((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    try {
      await removeStaffProjectPayRate(staffId, projectId);
      await reload();
    } catch (caught) {
      setProjectRowError((current) =>
        new Map(current).set(key, caught instanceof AgencyDbError ? caught.message : "Unable to remove this override."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onRecordProjectPayment(
    staffId: string,
    projectId: string,
    input: { method: PayrollPaymentMethod; reference: string; notes: string },
  ) {
    const key = projectRateKey(staffId, projectId);
    setBusyId(key);
    setProjectRowError((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
    try {
      await markTimeEntriesPaid(staffId, { ...input, projectId });
      setProjectPayModal(null);
      await reload();
    } catch (caught) {
      setProjectRowError((current) =>
        new Map(current).set(key, caught instanceof AgencyDbError ? caught.message : "Unable to record this payment."),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Payroll"
        description="Pay rates and unpaid hours. Visible to administrators only — not shared with staff via any assignment, unlike most other agency data."
      />

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : loadError ? (
        <p className="text-sm text-[#b45309]">{loadError}</p>
      ) : members.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-9">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No active staff</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Invite team members from Team to see them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search staff</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, title, or role"
                className={adminFilterControlState(Boolean(query.trim()))}
              />
            </label>
            <label className="lg:w-56">
              <span className="sr-only">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className={adminFilterControlState(role !== "All")}
              >
                <option value="All">All roles</option>
                {(data?.catalog.templates ?? []).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="lg:w-48">
              <span className="sr-only">Pay status</span>
              <select
                value={payStatus}
                onChange={(event) => setPayStatus(event.target.value as typeof payStatus)}
                className={adminFilterControlState(payStatus !== "All")}
              >
                <option value="All">All pay statuses</option>
                <option value="unpaid">Unpaid hours</option>
                <option value="paid">Paid up</option>
                <option value="no-rate">No rate set</option>
              </select>
            </label>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-9">
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No matching staff</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Try a different name, title, or role.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                    <th className="px-3 py-2.5">Staff</th>
                    <th className="px-3 py-2.5">Hourly rate</th>
                    <th className="px-3 py-2.5">Payout contact (Zelle / PayPal)</th>
                    <th className="px-3 py-2.5">Unpaid hours</th>
                    <th className="px-3 py-2.5">Amount owed</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                const rate = rates.get(member.id);
                const entries = entriesByStaff.get(member.id) ?? [];
                const breakdown = rate
                  ? projectPayBreakdown(
                      unpaidHoursByProject(entries),
                      rate.payRateCents,
                      new Map(
                        [...projectRates.values()]
                          .filter((item) => item.staffId === member.id)
                          .map((item) => [item.projectId, item.payRateCents]),
                      ),
                    )
                  : [];
                const overriddenProjectIds = new Set(breakdown.filter((item) => item.hasOverride).map((item) => item.projectId));
                // "Mark paid" below only settles projects WITHOUT their own override -- see
                // mark_time_entries_paid's p_project_id-omitted branch. These two numbers
                // must match what that button actually pays, not every unpaid hour.
                const globalPortion = breakdown.filter((item) => !item.hasOverride);
                const unpaidHours = sumHours(unpaidEntries(entries).filter((entry) => !overriddenProjectIds.has(entry.projectId)));
                const owedCents = globalPortion.reduce((total, item) => total + item.amountCents, 0);
                const draft = rateDrafts.has(member.id) ? rateDrafts.get(member.id)! : centsInputValue(rate?.payRateCents ?? 0);
                const busy = busyId === member.id;
                const error = rowError.get(member.id);
                const expanded = expandedStaffId === member.id;
                return (
                  <Fragment key={member.id}>
                  <tr className="border-t border-[var(--admin-line)]">
                    <td className="px-3 py-2.5">
                      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{member.fullName}</p>
                      <p className="text-[12px] text-[var(--admin-muted)]">{member.jobTitle.trim() || member.templateLabel}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          inputMode="decimal"
                          value={draft}
                          disabled={busy}
                          onChange={(event) =>
                            setRateDrafts((current) => new Map(current).set(member.id, event.target.value))
                          }
                          className="h-9 w-24 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          className="h-9 rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                          onClick={() => void onSaveRate(member.id)}
                        >
                          Save
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1.5">
                        <input
                          placeholder="Zelle phone/email"
                          disabled={busy}
                          value={zelleDrafts.has(member.id) ? zelleDrafts.get(member.id)! : rate?.zelleContact ?? ""}
                          onChange={(event) =>
                            setZelleDrafts((current) => new Map(current).set(member.id, event.target.value))
                          }
                          className="h-8 w-44 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-[12px] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                        />
                        <input
                          placeholder="PayPal email"
                          disabled={busy}
                          value={paypalDrafts.has(member.id) ? paypalDrafts.get(member.id)! : rate?.paypalEmail ?? ""}
                          onChange={(event) =>
                            setPaypalDrafts((current) => new Map(current).set(member.id, event.target.value))
                          }
                          className="h-8 w-44 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-[12px] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-[var(--admin-ink)]">{unpaidHours}h</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-[var(--admin-ink)]">
                      {rate ? formatUsdFromCents(owedCents) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy || unpaidHours <= 0 || !rate}
                          className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-40"
                          onClick={() => setPayModalFor(member.id)}
                        >
                          Mark paid
                        </button>
                        {breakdown.length > 0 ? (
                          <button
                            type="button"
                            className="h-9 rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                            onClick={() => setExpandedStaffId(expanded ? null : member.id)}
                          >
                            {expanded ? "Hide" : "Per project"}
                          </button>
                        ) : null}
                      </div>
                      {error ? <p className="mt-1 text-[12px] text-[#b45309]">{error}</p> : null}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-t border-[var(--admin-line)] bg-[var(--admin-bg)]">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="overflow-x-auto rounded-lg border border-[var(--admin-line)] bg-white">
                          <table className="w-full min-w-[640px] border-collapse text-left">
                            <thead>
                              <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                                <th className="px-3 py-2">Project</th>
                                <th className="px-3 py-2">Unpaid hours</th>
                                <th className="px-3 py-2">Rate</th>
                                <th className="px-3 py-2">Amount</th>
                                <th className="px-3 py-2" />
                              </tr>
                            </thead>
                            <tbody>
                              {breakdown.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-3 py-3 text-[13px] text-[var(--admin-muted)]">
                                    No unpaid hours logged against any project yet.
                                  </td>
                                </tr>
                              ) : (
                                breakdown.map((item) => {
                                  const key = projectRateKey(member.id, item.projectId);
                                  const rateDraft = projectRateDrafts.has(key)
                                    ? projectRateDrafts.get(key)!
                                    : item.hasOverride
                                      ? centsInputValue(item.rateCents)
                                      : "";
                                  const rowBusy = busyId === key;
                                  const rowErr = projectRowError.get(key);
                                  return (
                                    <tr key={item.projectId} className="border-t border-[var(--admin-line)]">
                                      <td className="px-3 py-2 text-[13px] text-[var(--admin-ink)]">
                                        {projectsById.get(item.projectId) ?? "Unknown project"}
                                      </td>
                                      <td className="px-3 py-2 text-[13px] text-[var(--admin-ink)]">{item.hours}h</td>
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            inputMode="decimal"
                                            placeholder={centsInputValue(rate?.payRateCents ?? 0)}
                                            value={rateDraft}
                                            disabled={rowBusy}
                                            onChange={(event) =>
                                              setProjectRateDrafts((current) => new Map(current).set(key, event.target.value))
                                            }
                                            className="h-8 w-20 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-[13px] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                                          />
                                          <button
                                            type="button"
                                            disabled={rowBusy}
                                            className="h-8 rounded-lg border border-[var(--admin-line)] px-2 font-heading text-[11px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                                            onClick={() => void onSaveProjectRate(member.id, item.projectId)}
                                          >
                                            Set
                                          </button>
                                          {item.hasOverride ? (
                                            <button
                                              type="button"
                                              disabled={rowBusy}
                                              className="h-8 rounded-lg px-2 font-heading text-[11px] font-semibold text-[var(--admin-muted)] hover:text-[#b45309] disabled:opacity-50"
                                              onClick={() => void onRemoveProjectRate(member.id, item.projectId)}
                                            >
                                              Use default
                                            </button>
                                          ) : (
                                            <span className="text-[11px] text-[var(--admin-muted)]">default</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-[13px] font-semibold text-[var(--admin-ink)]">
                                        {formatUsdFromCents(item.amountCents)}
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          type="button"
                                          disabled={rowBusy || item.hours <= 0}
                                          className="h-8 rounded-lg bg-[var(--admin-navy)] px-2.5 font-heading text-[11px] font-semibold text-white disabled:opacity-40"
                                          onClick={() => setProjectPayModal({ staffId: member.id, projectId: item.projectId })}
                                        >
                                          Pay this project
                                        </button>
                                        {rowErr ? <p className="mt-1 text-[11px] text-[#b45309]">{rowErr}</p> : null}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {payModalFor
        ? (() => {
            const member = members.find((item) => item.id === payModalFor);
            const rate = rates.get(payModalFor);
            const entries = entriesByStaff.get(payModalFor) ?? [];
            const overrides = new Map(
              [...projectRates.values()].filter((item) => item.staffId === payModalFor).map((item) => [item.projectId, item.payRateCents]),
            );
            const overriddenProjectIds = new Set(overrides.keys());
            // Matches mark_time_entries_paid's p_project_id-omitted branch exactly:
            // hours on a project with its own rate are excluded here.
            const unpaidHours = sumHours(unpaidEntries(entries).filter((entry) => !overriddenProjectIds.has(entry.projectId)));
            const owedCents = rate
              ? projectPayBreakdown(unpaidHoursByProject(entries), rate.payRateCents, overrides)
                  .filter((item) => !item.hasOverride)
                  .reduce((total, item) => total + item.amountCents, 0)
              : 0;
            return (
              <RecordPayrollPaymentModal
                open
                busy={busyId === payModalFor}
                staffName={member?.fullName ?? "this staff member"}
                unpaidHours={unpaidHours}
                owedCents={owedCents}
                zelleContact={rate?.zelleContact}
                paypalEmail={rate?.paypalEmail}
                onClose={() => setPayModalFor(null)}
                onConfirm={(input) => void onRecordPayment(payModalFor, input)}
              />
            );
          })()
        : null}

      {projectPayModal
        ? (() => {
            const member = members.find((item) => item.id === projectPayModal.staffId);
            const rate = rates.get(projectPayModal.staffId);
            const entries = entriesByStaff.get(projectPayModal.staffId) ?? [];
            const override = projectRates.get(projectRateKey(projectPayModal.staffId, projectPayModal.projectId));
            const effectiveRateCents = override?.payRateCents ?? rate?.payRateCents ?? 0;
            const unpaidHours = sumHours(
              unpaidEntries(entries).filter((entry) => entry.projectId === projectPayModal.projectId),
            );
            const owedCents = Math.round(unpaidHours * effectiveRateCents);
            const key = projectRateKey(projectPayModal.staffId, projectPayModal.projectId);
            return (
              <RecordPayrollPaymentModal
                open
                busy={busyId === key}
                staffName={member?.fullName ?? "this staff member"}
                projectLabel={projectsById.get(projectPayModal.projectId) ?? "this project"}
                unpaidHours={unpaidHours}
                owedCents={owedCents}
                zelleContact={rate?.zelleContact}
                paypalEmail={rate?.paypalEmail}
                onClose={() => setProjectPayModal(null)}
                onConfirm={(input) => void onRecordProjectPayment(projectPayModal.staffId, projectPayModal.projectId, input)}
              />
            );
          })()
        : null}
    </div>
  );
}
