import { useEffect, useState, type FormEvent } from "react";
import { useLeads, usePortalIdentity } from "@/components/admin/leads/LeadsProvider";
import { formatUsdFromCents } from "@/data/money";
import { SERVICE_PLAN_STATUS_LABELS, SERVICE_PLAN_TYPE_LABELS, type ServicePlan } from "@/data/servicePlans";
import { listServicePlans } from "@/data/servicePlansRepository";
import { site } from "@/data/site";
import { AgencyDbError } from "@/lib/dbErrors";

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
  const { notify } = useLeads();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [projectUpdates, setProjectUpdates] = useState(true);
  const [saved, setSaved] = useState(false);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    const prefs = loadPrefs();
    setEmailNotifications(prefs.emailNotifications);
    setProjectUpdates(prefs.projectUpdates);
  }, []);

  useEffect(() => {
    let active = true;
    setPlansLoading(true);
    listServicePlans()
      .then((rows) => {
        if (active) setPlans(rows.filter((plan) => plan.status !== "canceled"));
      })
      .catch((caught) => {
        if (active) setPlansError(caught instanceof AgencyDbError ? caught.message : "Unable to load your plans.");
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
            <ul className="mt-4 space-y-3">
              {plans.map((plan) => (
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
                        plan.status === "past_due" ? "text-[#b45309]" : "text-[var(--client-muted)]"
                      }`}
                    >
                      {SERVICE_PLAN_STATUS_LABELS[plan.status]}
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
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

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
