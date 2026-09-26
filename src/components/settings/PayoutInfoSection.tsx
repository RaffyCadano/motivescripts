import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatUsdFromCents } from "@/data/money";
import { type StaffPayRate } from "@/data/payroll";
import { listStaffPayRates } from "@/data/payrollRepository";
import { type StaffOnboarding } from "@/data/staffOnboarding";
import { fetchStaffOnboarding } from "@/data/staffOnboardingRepository";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-[var(--admin-ink)]">{label}</p>
      <p className="mt-1.5 flex h-10 items-center rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-muted)]">
        {value}
      </p>
    </div>
  );
}

/**
 * Read-only pay rate and payout details for the signed-in staff member. Admins can read every pay rate, so
 * the row is picked out by user id rather than taken from the top of the list.
 */
export function PayoutInfoSection({
  userId,
  historyHref,
  historyLabel,
}: {
  userId: string;
  /** Where this person's payment history lives, when they have such a page (production team: My Time). */
  historyHref?: string;
  historyLabel?: string;
}) {
  const [payRate, setPayRate] = useState<StaffPayRate | null>(null);
  const [onboarding, setOnboarding] = useState<StaffOnboarding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rates, submitted] = await Promise.all([listStaffPayRates(), fetchStaffOnboarding(userId).catch(() => null)]);
        if (cancelled) return;
        setPayRate(rates.find((rate) => rate.userId === userId) ?? null);
        setOnboarding(submitted);
      } catch {
        // Non-fatal: the rest of the profile page still works if this fails to load.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
      <h2 className="font-heading text-sm font-semibold">Pay &amp; payout info</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--admin-muted)]">
        Read-only. Contact your admin to set or correct any of this.
        {historyHref ? (
          <>
            {" "}
            Your payment history is on{" "}
            <Link to={historyHref} className="font-medium text-[var(--admin-blue)] hover:underline">
              {historyLabel ?? "My Time"}
            </Link>
            .
          </>
        ) : null}
      </p>
      {loading ? null : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ReadOnlyField label="Pay rate" value={payRate ? `${formatUsdFromCents(payRate.payRateCents)}/hr` : "Not set"} />
          <ReadOnlyField label="Zelle" value={payRate?.zelleContact || onboarding?.zelleContact || "Not set"} />
          <ReadOnlyField label="PayPal" value={payRate?.paypalEmail || onboarding?.paypalEmail || "Not set"} />
        </div>
      )}
    </section>
  );
}
