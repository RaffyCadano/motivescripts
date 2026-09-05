import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { RecordPayrollPaymentModal } from "@/components/admin/payroll/RecordPayrollPaymentModal";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { amountOwedCents, sumHours, unpaidEntries, type TimeEntry } from "@/data/timeEntries";
import { listMyTimeEntries } from "@/data/timeEntriesRepository";
import { listStaffPayRates, markTimeEntriesPaid, setStaffPayRate } from "@/data/payrollRepository";
import { type PayrollPaymentMethod, type StaffPayRate } from "@/data/payroll";
import { centsInputValue, formatUsdFromCents, parseDollarsToCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminPayroll() {
  const { profile } = useAuth();
  const isAdmin = isActiveAdmin(profile);
  const { data } = useTeamDirectory();
  const [rates, setRates] = useState<Map<string, StaffPayRate>>(new Map());
  const [entriesByStaff, setEntriesByStaff] = useState<Map<string, TimeEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rateDrafts, setRateDrafts] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Map<string, string>>(new Map());
  const [payModalFor, setPayModalFor] = useState<string | null>(null);

  const members = useMemo(() => (data?.members ?? []).filter((member) => member.isActive), [data?.members]);

  async function reload() {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const rateRows = await listStaffPayRates();
      setRates(new Map(rateRows.map((row) => [row.userId, row])));
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
    setBusyId(userId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(userId);
      return next;
    });
    try {
      await setStaffPayRate(userId, cents);
      await reload();
      setRateDrafts((current) => {
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
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
                <th className="px-3 py-2.5">Staff</th>
                <th className="px-3 py-2.5">Hourly rate</th>
                <th className="px-3 py-2.5">Unpaid hours</th>
                <th className="px-3 py-2.5">Amount owed</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const rate = rates.get(member.id);
                const entries = entriesByStaff.get(member.id) ?? [];
                const unpaidHours = sumHours(unpaidEntries(entries));
                const owedCents = rate ? amountOwedCents(entries, rate.payRateCents) : 0;
                const draft = rateDrafts.has(member.id) ? rateDrafts.get(member.id)! : centsInputValue(rate?.payRateCents ?? 0);
                const busy = busyId === member.id;
                const error = rowError.get(member.id);
                return (
                  <tr key={member.id} className="border-t border-[var(--admin-line)]">
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
                    <td className="px-3 py-2.5 text-sm text-[var(--admin-ink)]">{unpaidHours}h</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-[var(--admin-ink)]">
                      {rate ? formatUsdFromCents(owedCents) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        disabled={busy || unpaidHours <= 0 || !rate}
                        className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-40"
                        onClick={() => setPayModalFor(member.id)}
                      >
                        Mark paid
                      </button>
                      {error ? <p className="mt-1 text-[12px] text-[#b45309]">{error}</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payModalFor
        ? (() => {
            const member = members.find((item) => item.id === payModalFor);
            const rate = rates.get(payModalFor);
            const entries = entriesByStaff.get(payModalFor) ?? [];
            const unpaidHours = sumHours(unpaidEntries(entries));
            const owedCents = rate ? amountOwedCents(entries, rate.payRateCents) : 0;
            return (
              <RecordPayrollPaymentModal
                open
                busy={busyId === payModalFor}
                staffName={member?.fullName ?? "this staff member"}
                unpaidHours={unpaidHours}
                owedCents={owedCents}
                onClose={() => setPayModalFor(null)}
                onConfirm={(input) => void onRecordPayment(payModalFor, input)}
              />
            );
          })()
        : null}
    </div>
  );
}
