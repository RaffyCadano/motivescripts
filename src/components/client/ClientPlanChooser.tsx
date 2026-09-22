import { useEffect, useState } from "react";
import { planOfferState } from "@/data/clientPlanOffer";
import type { MaintenancePlanTemplate } from "@/data/maintenancePlanTemplates";
import { fetchPublishedMaintenancePlanTemplates } from "@/data/maintenancePlanTemplatesRepository";
import { formatUsdWhole } from "@/data/money";
import { careService } from "@/data/pricing";
import type { ServicePlan } from "@/data/servicePlans";
import { startClientPlanCheckout } from "@/data/servicePlansRepository";
import { site } from "@/data/site";
import { AgencyDbError } from "@/lib/dbErrors";

/**
 * "Choose a plan", shown in the client portal once the website has launched. Picking one sends the client to
 * Stripe's secure checkout, where they see the price and confirm; nothing is charged before that. The price
 * and the launch rule are decided by the server, so this is only the front door. Website Care is tiered
 * (Essential/Business/Pro), fetched live so a client always sees the current tiers -- falls back to a single
 * generic Care option while the fetch is in flight or if it fails. Hosting and SEO are not sold separately;
 * they're included starting at the Essential and Pro tiers respectively.
 */
export function ClientPlanChooser({
  projectId,
  projectName,
  plans,
}: {
  projectId: string;
  projectName: string;
  plans: ServicePlan[];
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [careTiers, setCareTiers] = useState<MaintenancePlanTemplate[]>([]);

  useEffect(() => {
    let active = true;
    void fetchPublishedMaintenancePlanTemplates().then((rows) => {
      if (active) setCareTiers(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  async function go(key: string, input: { planType: string; projectId: string; templateId?: string } | { planId: string }) {
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      const url = await startClientPlanCheckout(input);
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "We couldn’t start checkout. Please try again.");
      setBusyKey(null);
    }
  }

  const careState = planOfferState("care", projectId, plans);

  return (
    <section
      id="plans"
      className="scroll-mt-4 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6"
    >
      <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Choose a plan</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        {projectName} is live. This optional monthly plan keeps it running smoothly. You&apos;ll review the price and
        confirm on Stripe&apos;s secure checkout page, and nothing is charged until you do. It&apos;s billed monthly and
        renews automatically until you cancel. You can cancel any time from Active plans above, and you won&apos;t be
        charged again. To change a plan, contact{" "}
        <a className="font-medium underline underline-offset-2" href={`mailto:${site.email}`}>
          {site.email}
        </a>
        .
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg border border-[rgb(217_119_6_/_0.4)] bg-[rgb(217_119_6_/_0.06)] px-3 py-2 text-sm text-[#92610a]">
          {error}
        </p>
      ) : null}

      {careTiers.length > 0 ? (
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {careTiers.map((tier) => {
            const key = `care:${tier.id}`;
            const busy = busyKey === key;
            return (
              <li key={tier.id} className="flex flex-col rounded-[var(--client-radius)] border border-[var(--client-line)] p-4">
                <h3 className="font-heading text-base font-semibold text-[var(--client-ink)]">{tier.name}</h3>
                {tier.description ? (
                  <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--client-muted)]">{tier.description}</p>
                ) : (
                  <div className="flex-1" />
                )}
                {tier.includedServices.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {tier.includedServices.map((item) => (
                      <li key={item} className="text-[12px] text-[var(--client-muted)]">
                        • {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-4 font-heading text-2xl font-semibold tracking-tight text-[var(--client-ink)]">
                  {formatUsdWhole(tier.monthlyPriceCents)}
                  <span className="text-sm font-medium text-[var(--client-muted)]">/month</span>
                </p>
                {careState.kind === "subscribed" ? (
                  <p
                    className={`mt-3 text-[13px] font-semibold ${careState.status === "past_due" ? "text-[#b45309]" : "text-[#0f7a56]"}`}
                  >
                    {careState.status === "past_due" ? "Active — payment needs attention" : "You have a Care plan"}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() =>
                      void go(
                        key,
                        careState.kind === "pending"
                          ? { planId: careState.planId }
                          : { planType: "care", projectId, templateId: tier.id },
                      )
                    }
                    className="mt-3 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
                  >
                    {busy ? "Opening checkout…" : careState.kind === "pending" ? "Continue to checkout" : "Choose this tier"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 max-w-sm">
          <div className="flex flex-col rounded-[var(--client-radius)] border border-[var(--client-line)] p-4">
            <h3 className="font-heading text-base font-semibold text-[var(--client-ink)]">{careService.name}</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--client-muted)]">{careService.description}</p>
            <p className="mt-4 font-heading text-2xl font-semibold tracking-tight text-[var(--client-ink)]">
              {careService.price}
              <span className="text-sm font-medium text-[var(--client-muted)]">/month</span>
            </p>
            {careState.kind === "subscribed" ? (
              <p
                className={`mt-3 text-[13px] font-semibold ${careState.status === "past_due" ? "text-[#b45309]" : "text-[#0f7a56]"}`}
              >
                {careState.status === "past_due" ? "Active — payment needs attention" : "You have a Care plan"}
              </p>
            ) : (
              <button
                type="button"
                disabled={busyKey !== null}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white opacity-60"
              >
                Loading tiers…
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
