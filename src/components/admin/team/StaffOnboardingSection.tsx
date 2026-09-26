import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { formatTeamDate } from "@/data/team";
import { type StaffOnboarding } from "@/data/staffOnboarding";
import { fetchStaffOnboarding, resetStaffOnboarding } from "@/data/staffOnboardingRepository";
import { AgencyDbError } from "@/lib/dbErrors";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 flex min-h-9 items-center break-words rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-1.5 text-sm text-[var(--admin-ink)]">
        {value || "—"}
      </p>
    </div>
  );
}

/**
 * Admin view of what a team member submitted when they first signed in: contact and payout details, and the
 * record of the agreement they accepted. "Ask them to redo it" sends them back through the form.
 */
export function StaffOnboardingSection({ userId, isStaff }: { userId: string; isStaff: boolean }) {
  const { profile } = useAuth();
  const [row, setRow] = useState<StaffOnboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = isActiveAdmin(profile);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStaffOnboarding(userId)
      .then((value) => {
        if (!cancelled) setRow(value);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load onboarding details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function redo() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await resetStaffOnboarding(userId);
      setRow(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to reset onboarding.");
    } finally {
      setBusy(false);
    }
  }

  if (!isStaff) return null;

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Onboarding</h2>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
            Details they gave the first time they signed in, and the agreement they accepted.
          </p>
        </div>
        {row && canManage ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void redo()}
            className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-50"
          >
            {busy ? "Resetting…" : "Ask them to redo it"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-[#b45309]">{error}</p> : null}

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
      ) : !row ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-[#b45309] ring-1 ring-amber-200">
          Not finished yet. They see the welcome form the next time they sign in, and can’t open their workspace until
          it’s done.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Legal name" value={row.legalName} />
            <Detail label="Phone" value={row.phone} />
            <Detail label="Zelle" value={row.zelleContact} />
            <Detail label="PayPal" value={row.paypalEmail} />
            <Detail label="Emergency contact" value={row.emergencyName} />
            <Detail label="Emergency phone" value={row.emergencyPhone} />
          </div>
          <p className="text-[12px] text-[var(--admin-muted)]">
            Signed as “{row.signedName}” on {formatTeamDate(row.agreementAcceptedAt)} · agreement version{" "}
            {row.agreementVersion}. Their Zelle and PayPal details also show on the Payroll card. Pay rates are still
            set on the Payroll page.
          </p>
        </div>
      )}
    </section>
  );
}
