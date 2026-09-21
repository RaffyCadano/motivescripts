import { useState } from "react";
import { planOfferState } from "@/data/clientPlanOffer";
import { ongoingServices } from "@/data/pricing";
import type { ServicePlan } from "@/data/servicePlans";
import { startClientPlanCheckout } from "@/data/servicePlansRepository";
import { site } from "@/data/site";
import { AgencyDbError } from "@/lib/dbErrors";

/**
 * "Choose a plan", shown in the client portal once the website has launched. Picking one sends the client to
 * Stripe's secure checkout, where they see the price and confirm; nothing is charged before that. The price
 * and the launch rule are decided by the server, so this is only the front door.
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
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(planType: string, input: { planType: string; projectId: string } | { planId: string }) {
    if (busyType) return;
    setBusyType(planType);
    setError(null);
    try {
      const url = await startClientPlanCheckout(input);
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "We couldn’t start checkout. Please try again.");
      setBusyType(null);
    }
  }

  return (
    <section
      id="plans"
      className="scroll-mt-4 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6"
    >
      <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Choose a plan</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        {projectName} is live. These optional monthly plans keep it running smoothly. You&apos;ll review the price and
        confirm on Stripe&apos;s secure checkout page, and nothing is charged until you do. Plans are billed monthly and
        renew automatically until you cancel. You can cancel any time from Active plans above, and you won&apos;t be
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

      <ul className="mt-5 grid gap-3 md:grid-cols-3">
        {ongoingServices.map((service) => {
          const state = planOfferState(service.planType, projectId, plans);
          const busy = busyType === service.planType;
          return (
            <li key={service.id} className="flex flex-col rounded-[var(--client-radius)] border border-[var(--client-line)] p-4">
              <h3 className="font-heading text-base font-semibold text-[var(--client-ink)]">{service.name}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--client-muted)]">{service.description}</p>
              <p className="mt-4 font-heading text-2xl font-semibold tracking-tight text-[var(--client-ink)]">
                {service.price}
                <span className="text-sm font-medium text-[var(--client-muted)]">/month</span>
              </p>
              {state.kind === "subscribed" ? (
                <p
                  className={`mt-3 text-[13px] font-semibold ${state.status === "past_due" ? "text-[#b45309]" : "text-[#0f7a56]"}`}
                >
                  {state.status === "past_due" ? "Active — payment needs attention" : "You have this plan"}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={busyType !== null}
                  onClick={() =>
                    void go(service.planType, state.kind === "pending" ? { planId: state.planId } : { planType: service.planType, projectId })
                  }
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
                >
                  {busy ? "Opening checkout…" : state.kind === "pending" ? "Continue to checkout" : "Choose plan"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
