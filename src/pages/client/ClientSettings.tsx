import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useLeads, usePortalIdentity, usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { ClientCareRequests } from "@/components/client/ClientCareRequests";
import { ClientPlanChooser } from "@/components/client/ClientPlanChooser";
import { useClientPlanOffer } from "@/components/client/useClientPlanOffer";
import { clientCancelMode, scheduledEnd } from "@/data/clientPlanOffer";
import { formatUsdFromCents } from "@/data/money";
import { SERVICE_PLAN_STATUS_LABELS, SERVICE_PLAN_TYPE_LABELS, type ServicePlan } from "@/data/servicePlans";
import { cancelMyServicePlan, resumeMyServicePlan } from "@/data/servicePlansRepository";
import { site } from "@/data/site";
import { AgencyDbError } from "@/lib/dbErrors";

function formatPlanDate(iso: string | null): string {
  if (!iso) return "the end of your current billing period";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "the end of your current billing period";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const PREFS_KEY = "motivescripts.client.device-notification-prefs";

type DevicePrefs = {
  emailNotifications: boolean;
  projectUpdates: boolean;
};

function loadPrefs(): DevicePrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { emailNotifications: true, projectUpdates: true };
    const parsed = JSON.parse(raw) as Partial<DevicePrefs>;
    return {
      emailNotifications: parsed.emailNotifications !== false,
      projectUpdates: parsed.projectUpdates !== false,
    };
  } catch {
    return { emailNotifications: true, projectUpdates: true };
  }
}

export function ClientSettings() {
  const identity = usePortalIdentity();
  const { client } = usePortalSession();
  const { notify } = useLeads();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [projectUpdates, setProjectUpdates] = useState(true);
  const [saved, setSaved] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const planReturn = searchParams.get("plan");
  const { project, projectId, launched, plans: allPlans, loading: plansLoading, error: plansError, reloadPlans } =
    useClientPlanOffer();
  const plans = useMemo(() => allPlans.filter((plan) => plan.status !== "canceled"), [allPlans]);

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
    setConfirmCancelId(null);
    setPlanBusyId(plan.id);
    setPlanActionError(null);
    setPlanNotice(null);
    try {
      const result = await cancelMyServicePlan(plan.id);
      setPlanNotice(
        result.mode === "now"
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

  useEffect(() => {
    const prefs = loadPrefs();
    setEmailNotifications(prefs.emailNotifications);
    setProjectUpdates(prefs.projectUpdates);
  }, []);

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

  // Arriving from the Overview nudge (/client/settings#plans): scroll once the section has rendered.
  useEffect(() => {
    if (plansLoading || window.location.hash !== "#plans") return;
    document.getElementById("plans")?.scrollIntoView({ block: "start" });
  }, [plansLoading, launched]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ emailNotifications, projectUpdates } satisfies DevicePrefs),
    );
    setSaved(true);
    notify("Preferences saved");
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          Manage your profile information and notification preferences.
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

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Profile</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
          Profile information is managed through your MotiveScripts account.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <ProfileItem label="Name" value={identity.name} />
          <ProfileItem label="Email" value={identity.email || "—"} />
          <ProfileItem label="Business name" value={identity.businessName} />
          <ProfileItem label="Phone" value={identity.phone || "—"} />
        </dl>
      </section>

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
                      {busy ? "Working…" : "Cancel plan"}
                    </button>
                  ) : null}

                  {cancelMode && confirmCancelId === plan.id ? (
                    <div
                      role="alertdialog"
                      aria-label={`Confirm canceling ${plan.label}`}
                      className="mt-3 rounded-lg border border-[rgb(217_119_6_/_0.4)] bg-[rgb(217_119_6_/_0.06)] p-3"
                    >
                      <p className="text-[13px] font-semibold text-[var(--client-ink)]">Cancel “{plan.label}”?</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--client-muted)]">
                        {cancelMode === "period_end"
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
                          Yes, cancel plan
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(null)}
                          className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--client-ink)]"
                        >
                          Keep plan
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

      {launched && client && projectId ? <ClientCareRequests clientId={client.id} projectId={projectId} /> : null}

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Notifications</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--client-ink)]">Browser reminders</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
          These preferences only control reminders shown on this device. They do not unsubscribe you from required
          account, document, payment, or security emails.
        </p>

        <form className="mt-5 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-3">
            <Toggle
              id="email-notes"
              label="Show email reminders on this device"
              hint="Remembers this choice in this browser. MotiveScripts will still send required emails."
              checked={emailNotifications}
              onChange={(checked) => {
                setEmailNotifications(checked);
                setSaved(false);
              }}
            />
            <Toggle
              id="project-updates"
              label="Show project reminders on this device"
              hint="Remembers this choice in this browser. It does not change project email notifications."
              checked={projectUpdates}
              onChange={(checked) => {
                setProjectUpdates(checked);
                setSaved(false);
              }}
            />
          </div>

          <div className="rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--client-ink)]">Emails you will still receive</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
              Proposal and contract review notices, invoices and payment confirmations, and account security messages
              are sent by MotiveScripts and cannot be turned off here.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
              >
                Save Preferences
              </button>
              {saved ? (
                <p className="text-sm font-medium text-[#0f7a56]" role="status">
                  Preferences saved
                </p>
              ) : null}
            </div>
            <p className="text-sm text-[var(--client-muted)]">Saved on this device.</p>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3">
      <dt className="text-[12px] text-[var(--client-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--client-ink)]">{value}</dd>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--client-ink)]">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--client-muted)]">{hint}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-10 rounded-full bg-[var(--client-line)] transition-colors peer-checked:bg-[var(--client-blue)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--client-blue)]" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
