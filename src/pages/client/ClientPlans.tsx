import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { ClientCareRequests } from "@/components/client/ClientCareRequests";
import { ClientPlanChooser } from "@/components/client/ClientPlanChooser";
import { ClientWebsiteVersions } from "@/components/client/ClientWebsiteVersions";
import { useClientPlanOffer } from "@/components/client/useClientPlanOffer";
import { clientCancelMode, scheduledEnd } from "@/data/clientPlanOffer";
import { fetchClientDeliveryStatus, type ClientDeliveryStatus } from "@/data/clientProjectProgress";
import { formatUsdFromCents } from "@/data/money";
import { SERVICE_PLAN_STATUS_LABELS, SERVICE_PLAN_TYPE_LABELS, type ServicePlan } from "@/data/servicePlans";
import { cancelMyServicePlan, fetchServicePlanUsage, resumeMyServicePlan, type ServicePlanUsage } from "@/data/servicePlansRepository";
import { formatBackupRelativeTime, lastSuccessfulBackup, type WebsiteBackup } from "@/data/websiteBackups";
import { fetchWebsiteBackupHistory } from "@/data/websiteBackupsRepository";
import { site } from "@/data/site";
import { AgencyDbError } from "@/lib/dbErrors";

const deliveryStatusToneClass: Record<string, string> = {
  Configured: "text-emerald-800",
  "In progress": "text-[var(--client-blue)]",
  Issue: "text-[#b45309]",
  "Not configured": "text-[var(--client-muted)]",
};

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPlanDate(iso: string | null): string {
  if (!iso) return "the end of your current billing period";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "the end of your current billing period";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * The account's billing relationship with MotiveScripts after launch: active plans, choosing one,
 * and Website Care requests. Its own page (reached from the profile dropdown, not the sidebar) so
 * it isn't buried inside Settings.
 */
export function ClientPlans() {
  const { client } = usePortalSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const planReturn = searchParams.get("plan");
  const { project, projectId, launched, plans: allPlans, loading: plansLoading, error: plansError, reloadPlans } =
    useClientPlanOffer();
  const plans = useMemo(() => allPlans.filter((plan) => plan.status !== "canceled"), [allPlans]);
  // Scoped to the project actually being viewed (project-specific plan preferred, falling back to
  // an account-level one with no project_id) -- a client with more than one project must not have
  // this page show a different project's Care plan hours/status just because it happens to sort
  // first in allPlans, which spans every project the client has.
  const currentProjectCarePlans = useMemo(
    () =>
      allPlans.filter(
        (plan) =>
          plan.planType === "care" &&
          (plan.status === "active" || plan.status === "past_due") &&
          (plan.projectId === projectId || plan.projectId === null),
      ),
    [allPlans, projectId],
  );
  const hasActiveCarePlan = currentProjectCarePlans.length > 0;
  const activeCarePlan = useMemo(
    () =>
      currentProjectCarePlans.find((plan) => plan.projectId === projectId) ?? currentProjectCarePlans[0] ?? null,
    [currentProjectCarePlans, projectId],
  );

  const [deliveryStatus, setDeliveryStatus] = useState<ClientDeliveryStatus | null>(null);
  const [usage, setUsage] = useState<ServicePlanUsage | null>(null);
  const [latestBackup, setLatestBackup] = useState<WebsiteBackup | null>(null);

  useEffect(() => {
    if (!projectId || !launched) {
      setDeliveryStatus(null);
      return;
    }
    let active = true;
    void fetchClientDeliveryStatus(projectId)
      .then((status) => {
        if (active) setDeliveryStatus(status);
      })
      .catch(() => {
        if (active) setDeliveryStatus(null);
      });
    return () => {
      active = false;
    };
  }, [projectId, launched]);

  // Status-only, matching the domain/hosting/SSL display above -- clients see that backups are
  // happening, not the files themselves (storage access stays staff-only).
  useEffect(() => {
    if (!projectId || !hasActiveCarePlan) {
      setLatestBackup(null);
      return;
    }
    let active = true;
    void fetchWebsiteBackupHistory(projectId)
      .then((backups) => {
        if (active) setLatestBackup(lastSuccessfulBackup(backups));
      })
      .catch(() => {
        if (active) setLatestBackup(null);
      });
    return () => {
      active = false;
    };
  }, [projectId, hasActiveCarePlan]);

  useEffect(() => {
    if (!activeCarePlan) {
      setUsage(null);
      return;
    }
    let active = true;
    void fetchServicePlanUsage(activeCarePlan.id)
      .then((result) => {
        if (active) setUsage(result);
      })
      .catch(() => {
        if (active) setUsage(null);
      });
    return () => {
      active = false;
    };
  }, [activeCarePlan]);

  // Canceling a plan is a two-step action, and what it does depends on the plan (see clientCancelMode).
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [planBusyId, setPlanBusyId] = useState<string | null>(null);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [planActionError, setPlanActionError] = useState<string | null>(null);

  // The plan list changes when Stripe's confirmation reaches us, a few seconds after the action.
  function refreshPlansSoon() {
    void reloadPlans();
    window.setTimeout(() => void reloadPlans(), 3000);
    window.setTimeout(() => void reloadPlans(), 7000);
  }

  async function onCancelPlan(plan: ServicePlan) {
    const mode = clientCancelMode(plan);
    setConfirmCancelId(null);
    setPlanBusyId(plan.id);
    setPlanActionError(null);
    setPlanNotice(null);
    try {
      const result = await cancelMyServicePlan(plan.id);
      setPlanNotice(
        mode === "abandon"
          ? `${plan.label} has been cleared. Choose it again anytime below.`
          : result.mode === "now"
            ? `${plan.label} is being canceled. You won’t be charged again.`
            : `${plan.label} will end on ${formatPlanDate(result.endsAt)}. You won’t be charged again, and it stays active until then.`,
      );
      refreshPlansSoon();
    } catch (caught) {
      setPlanActionError(caught instanceof AgencyDbError ? caught.message : "We couldn’t cancel this plan. Please try again or contact us.");
    } finally {
      setPlanBusyId(null);
    }
  }

  async function onKeepPlan(plan: ServicePlan) {
    setPlanBusyId(plan.id);
    setPlanActionError(null);
    setPlanNotice(null);
    try {
      await resumeMyServicePlan(plan.id);
      setPlanNotice(`Good news: ${plan.label} will continue as normal.`);
      refreshPlansSoon();
    } catch (caught) {
      setPlanActionError(caught instanceof AgencyDbError ? caught.message : "We couldn’t keep this plan. Please try again or contact us.");
    } finally {
      setPlanBusyId(null);
    }
  }

  // Back from Stripe: the plan turns Active when Stripe's confirmation reaches us, which can take a few seconds,
  // so keep checking for a short while instead of showing "Pending" as if nothing happened.
  useEffect(() => {
    if (planReturn !== "success") return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      void reloadPlans();
      if (tries >= 10) window.clearInterval(timer);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [planReturn, reloadPlans]);

  // Backed out of Stripe checkout instead of finishing it: the "Checkout was canceled" message above
  // would otherwise sit right next to that same plan still showing Pending, which reads as a
  // contradiction. Quietly clear it -- only if it's genuinely still pending (checked here again, not
  // just trusted from the URL, in case it was actually completed in another tab in the meantime).
  // Tried once per visit only: reloading afterwards re-runs this effect (allPlans is a new array), and
  // without the ref a failed attempt -- for any reason -- would retry forever instead of just leaving
  // the plan as something the client can still clear by hand.
  const abandonAttempted = useRef(false);
  useEffect(() => {
    const abandonedPlanId = searchParams.get("planId");
    if (planReturn !== "cancelled" || !abandonedPlanId || plansLoading || abandonAttempted.current) return;
    const stillPending = allPlans.some((plan) => plan.id === abandonedPlanId && plan.status === "pending");
    if (!stillPending) return;
    abandonAttempted.current = true;
    void cancelMyServicePlan(abandonedPlanId)
      .catch(() => {})
      .then(() => reloadPlans());
  }, [planReturn, searchParams, plansLoading, allPlans, reloadPlans]);

  // Arriving from the Overview nudge (/client/plans#plans): scroll once the section has rendered.
  useEffect(() => {
    if (plansLoading || window.location.hash !== "#plans") return;
    document.getElementById("plans")?.scrollIntoView({ block: "start" });
  }, [plansLoading, launched]);

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Plans &amp; Website Care</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          Optional monthly plans that keep your website running after launch, and where to ask for the small updates
          they cover.
        </p>
      </header>

      {planReturn === "success" || planReturn === "cancelled" ? (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-[var(--client-radius)] border px-4 py-3 text-sm ${
            planReturn === "success"
              ? "border-[rgb(16_185_129_/_0.35)] bg-[rgb(16_185_129_/_0.07)] text-[#0f7a56]"
              : "border-[var(--client-line)] bg-[var(--client-card)] text-[var(--client-muted)]"
          }`}
        >
          <p>
            {planReturn === "success"
              ? "Thank you! Your plan is being set up and will show as Active in a moment. Your first payment will appear in Invoices."
              : "Checkout was canceled and you haven’t been charged. You can choose a plan below whenever you’re ready."}
          </p>
          <button
            type="button"
            className="shrink-0 font-heading text-[12px] font-semibold underline underline-offset-2"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {plansLoading || plansError || plans.length > 0 ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Active plans</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
            Recurring services billed monthly. Charges appear in your Invoices as they happen.
          </p>
          {plansLoading ? (
            <div className="mt-4 h-16 animate-pulse rounded-lg bg-[var(--client-line)]/20" />
          ) : plansError ? (
            <p className="mt-4 text-sm text-[#b45309]">{plansError}</p>
          ) : (
            <>
            {planNotice ? (
              <p role="status" className="mt-4 rounded-lg border border-[rgb(16_185_129_/_0.35)] bg-[rgb(16_185_129_/_0.07)] px-3 py-2 text-sm text-[#0f7a56]">
                {planNotice}
              </p>
            ) : null}
            {planActionError ? (
              <p role="alert" className="mt-4 rounded-lg border border-[rgb(217_119_6_/_0.4)] bg-[rgb(217_119_6_/_0.06)] px-3 py-2 text-sm text-[#92610a]">
                {planActionError}
              </p>
            ) : null}
            <ul className="mt-4 space-y-3">
              {plans.map((plan) => {
                const endsOn = scheduledEnd(plan);
                const cancelMode = clientCancelMode(plan);
                const busy = planBusyId === plan.id;
                return (
                <li
                  key={plan.id}
                  className="rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--client-ink)]">{plan.label}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--client-muted)]">
                        {SERVICE_PLAN_TYPE_LABELS[plan.planType]} · {formatUsdFromCents(plan.amountCents)}/mo
                      </p>
                    </div>
                    <span
                      className={`text-[12px] font-semibold ${
                        plan.status === "past_due" || endsOn ? "text-[#b45309]" : "text-[var(--client-muted)]"
                      }`}
                    >
                      {endsOn ? `Ends ${formatPlanDate(endsOn)}` : SERVICE_PLAN_STATUS_LABELS[plan.status]}
                    </span>
                  </div>

                  {plan.planType === "care" && (plan.status === "active" || plan.status === "past_due") ? (
                    <div className="mt-3 grid gap-3 border-t border-[var(--client-line)] pt-3 sm:grid-cols-2">
                      {usage && plan.id === activeCarePlan?.id ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--client-muted)]">
                            Included hours this period
                          </p>
                          <p className="mt-0.5 text-sm text-[var(--client-ink)]">
                            {usage.usedHours} of {usage.includedHoursMonthly} used
                            {usage.includedHoursMonthly > 0 ? ` · ${usage.remainingHours} remaining` : ""}
                          </p>
                          <p className="text-[11px] text-[var(--client-muted)]">
                            {formatShortDate(usage.periodStart)} – {formatShortDate(usage.periodEnd)}
                          </p>
                        </div>
                      ) : null}
                      {plan.domain || deliveryStatus ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--client-muted)]">
                            Website status
                          </p>
                          {deliveryStatus ? (
                            <p className="mt-0.5 text-sm text-[var(--client-ink)]">
                              Hosting:{" "}
                              <span className={deliveryStatusToneClass[deliveryStatus.hostingStatus] ?? "text-[var(--client-muted)]"}>
                                {deliveryStatus.hostingStatus}
                              </span>
                              {" · "}
                              Domain:{" "}
                              <span className={deliveryStatusToneClass[deliveryStatus.domainStatus] ?? "text-[var(--client-muted)]"}>
                                {deliveryStatus.domainStatus}
                              </span>
                            </p>
                          ) : null}
                          {plan.sslExpiresAt ? (
                            <p className="text-[11px] text-[var(--client-muted)]">SSL renews {formatPlanDate(plan.sslExpiresAt)}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {plan.id === activeCarePlan?.id ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--client-muted)]">Backups</p>
                          <p className="mt-0.5 text-sm text-[var(--client-ink)]">
                            {latestBackup ? `Last backup ${formatBackupRelativeTime(latestBackup.createdAt)}` : "First automatic backup runs within a day"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {plan.status === "past_due" ? (
                    <p className="mt-2 text-[12px] leading-relaxed text-[#b45309]">
                      The last charge for this plan didn’t go through — check the card on file with your bank, or{" "}
                      <a className="font-medium underline underline-offset-2" href={`mailto:${site.email}`}>
                        contact us
                      </a>{" "}
                      and we’ll help sort it out.
                    </p>
                  ) : null}

                  {endsOn ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <p className="text-[12px] leading-relaxed text-[var(--client-muted)]">
                        This plan is canceled and stays active until {formatPlanDate(endsOn)}. You won’t be charged again.
                      </p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onKeepPlan(plan)}
                        className="font-heading text-[12px] font-semibold text-[var(--client-blue)] underline underline-offset-2 disabled:opacity-60"
                      >
                        {busy ? "Working…" : "Keep my plan"}
                      </button>
                    </div>
                  ) : null}

                  {cancelMode && confirmCancelId !== plan.id ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmCancelId(plan.id)}
                      className="mt-3 font-heading text-[12px] font-semibold text-[var(--client-muted)] underline underline-offset-2 hover:text-[var(--client-ink)] disabled:opacity-60"
                    >
                      {busy ? "Working…" : cancelMode === "abandon" ? "Never mind" : "Cancel plan"}
                    </button>
                  ) : null}

                  {cancelMode && confirmCancelId === plan.id ? (
                    <div
                      role="alertdialog"
                      aria-label={cancelMode === "abandon" ? `Confirm clearing ${plan.label}` : `Confirm canceling ${plan.label}`}
                      className="mt-3 rounded-lg border border-[rgb(217_119_6_/_0.4)] bg-[rgb(217_119_6_/_0.06)] p-3"
                    >
                      <p className="text-[13px] font-semibold text-[var(--client-ink)]">
                        {cancelMode === "abandon" ? `Clear “${plan.label}”?` : `Cancel “${plan.label}”?`}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--client-muted)]">
                        {cancelMode === "abandon"
                          ? "You haven’t been charged for this — it never made it through checkout. We’ll stop showing it as pending; choose it again anytime if you change your mind."
                          : cancelMode === "period_end"
                            ? "You won’t be charged again. The plan stays active until the end of the period you’ve already paid for, and you can change your mind before then."
                            : "Your last payment for this plan didn’t go through, so canceling ends it right away. You won’t be charged again."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onCancelPlan(plan)}
                          className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[#b45309] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-60"
                        >
                          {cancelMode === "abandon" ? "Yes, clear it" : "Yes, cancel plan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(null)}
                          className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--client-ink)]"
                        >
                          {cancelMode === "abandon" ? "Keep it pending" : "Keep plan"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
                );
              })}
            </ul>
            </>
          )}
        </section>
      ) : null}

      {launched && project && projectId ? (
        <ClientPlanChooser projectId={projectId} projectName={project.name} plans={allPlans} />
      ) : null}

      {launched && client && projectId ? (
        <ClientCareRequests
          clientId={client.id}
          projectId={projectId}
          hasActiveCarePlan={hasActiveCarePlan}
          trialEndsAt={deliveryStatus?.launchTrialEndsAt ?? null}
        />
      ) : null}

      {launched && projectId ? <ClientWebsiteVersions projectId={projectId} /> : null}
    </div>
  );
}
