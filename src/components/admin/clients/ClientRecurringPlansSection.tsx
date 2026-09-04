import { useEffect, useState } from "react";
import { useClientProjects } from "@/components/admin/leads/LeadsProvider";
import {
  SERVICE_PLAN_STATUS_LABELS,
  SERVICE_PLAN_TYPE_LABELS,
  type DomainAvailability,
  type ServicePlan,
  type ServicePlanType,
} from "@/data/servicePlans";
import {
  cancelServicePlan,
  checkDomainAvailability,
  createServicePlan,
  createServicePlanCheckoutUrl,
  listServicePlans,
  setServicePlanDomain,
} from "@/data/servicePlansRepository";
import { formatUsdFromCents, parseDollarsToCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";
import type { AgencyClient } from "@/data/agencyClients";

const PLAN_TYPES: ServicePlanType[] = ["care", "seo_retainer", "hosting", "custom"];

const statusBadgeClass: Record<ServicePlan["status"], string> = {
  pending: "border-[var(--admin-line)] text-[var(--admin-muted)]",
  active: "border-emerald-700/40 bg-[rgb(16_185_129_/_0.1)] text-emerald-800",
  past_due: "border-amber-700/40 bg-[rgb(217_119_6_/_0.1)] text-amber-800",
  canceled: "border-[var(--admin-line)] text-[var(--admin-muted)]",
};

const availabilityLabel: Record<DomainAvailability, string> = {
  available: "Available",
  taken: "Already registered",
  unknown: "Couldn't check — verify with your registrar",
};

const availabilityClass: Record<DomainAvailability, string> = {
  available: "text-emerald-700",
  taken: "text-[#b45309]",
  unknown: "text-[var(--admin-muted)]",
};

export function ClientRecurringPlansSection({ client }: { client: AgencyClient }) {
  const projects = useClientProjects(client.id);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Map<string, string>>(new Map());
  const [checkoutUrl, setCheckoutUrl] = useState<Map<string, string>>(new Map());
  const [domainDrafts, setDomainDrafts] = useState<Map<string, string>>(new Map());
  const [domainBusyId, setDomainBusyId] = useState<string | null>(null);
  const [domainStatus, setDomainStatus] = useState<Map<string, DomainAvailability>>(new Map());
  const [domainError, setDomainError] = useState<Map<string, string>>(new Map());

  const [formOpen, setFormOpen] = useState(false);
  const [planType, setPlanType] = useState<ServicePlanType>("care");
  const [label, setLabel] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [projectId, setProjectId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listServicePlans(client.id);
      setPlans(rows);
    } catch (caught) {
      setLoadError(caught instanceof AgencyDbError ? caught.message : "Unable to load plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  async function onCreate() {
    setFormError(null);
    const cents = parseDollarsToCents(amountInput);
    if (!label.trim()) {
      setFormError("Enter a name for this plan.");
      return;
    }
    if (cents === null || cents < 50) {
      setFormError("Enter a monthly amount of at least $0.50.");
      return;
    }
    setCreating(true);
    try {
      await createServicePlan({
        clientId: client.id,
        projectId: projectId || null,
        planType,
        label: label.trim(),
        amountCents: cents,
      });
      setLabel("");
      setAmountInput("");
      setProjectId("");
      setPlanType("care");
      setFormOpen(false);
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to create this plan.");
    } finally {
      setCreating(false);
    }
  }

  async function onSendCheckout(planId: string) {
    setBusyId(planId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      const url = await createServicePlanCheckoutUrl(planId);
      setCheckoutUrl((current) => new Map(current).set(planId, url));
    } catch (caught) {
      setRowError((current) =>
        new Map(current).set(planId, caught instanceof AgencyDbError ? caught.message : "Unable to create a checkout link."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(planId: string) {
    setBusyId(planId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      await cancelServicePlan(planId);
      await reload();
    } catch (caught) {
      setRowError((current) =>
        new Map(current).set(planId, caught instanceof AgencyDbError ? caught.message : "Unable to cancel this plan."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveDomain(planId: string) {
    const draft = domainDrafts.get(planId) ?? "";
    setDomainBusyId(planId);
    setDomainError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      await setServicePlanDomain(planId, draft);
      await reload();
    } catch (caught) {
      setDomainError((current) =>
        new Map(current).set(planId, caught instanceof AgencyDbError ? caught.message : "Unable to save the domain."),
      );
    } finally {
      setDomainBusyId(null);
    }
  }

  async function onCheckDomain(planId: string) {
    const draft = domainDrafts.get(planId) ?? "";
    setDomainBusyId(planId);
    setDomainError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      const status = await checkDomainAvailability(draft);
      setDomainStatus((current) => new Map(current).set(planId, status));
    } catch (caught) {
      setDomainError((current) =>
        new Map(current).set(planId, caught instanceof AgencyDbError ? caught.message : "Unable to check that domain."),
      );
    } finally {
      setDomainBusyId(null);
    }
  }

  return (
    <section
      id="plans"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recurring plans</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            Website Care, SEO retainers, and hosting billed monthly through Stripe. Each cycle creates a real invoice.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white"
          onClick={() => setFormOpen((open) => !open)}
        >
          {formOpen ? "Cancel" : "New plan"}
        </button>
      </div>

      {formOpen ? (
        <div className="mt-4 space-y-3 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Plan type
              <select
                value={planType}
                onChange={(event) => setPlanType(event.target.value as ServicePlanType)}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              >
                {PLAN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SERVICE_PLAN_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Project (optional)
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              >
                <option value="">No specific project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Name
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Website Care Plan"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Monthly amount (USD)
              <input
                inputMode="decimal"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="75.00"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
          </div>
          {formError ? <p className="text-[12px] text-[#b45309]">{formError}</p> : null}
          <button
            type="button"
            disabled={creating}
            className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
            onClick={() => void onCreate()}
          >
            Create plan
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : loadError ? (
        <p className="mt-4 text-sm text-[#b45309]">{loadError}</p>
      ) : plans.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No recurring plans for this client yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {plans.map((plan) => {
            const busy = busyId === plan.id;
            const error = rowError.get(plan.id);
            const url = checkoutUrl.get(plan.id);
            return (
              <li key={plan.id} className="rounded-lg border border-[var(--admin-line)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--admin-ink)]">{plan.label}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                      {SERVICE_PLAN_TYPE_LABELS[plan.planType]} · {formatUsdFromCents(plan.amountCents)}/mo
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass[plan.status]}`}
                  >
                    {SERVICE_PLAN_STATUS_LABELS[plan.status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {plan.status === "pending" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                      onClick={() => void onSendCheckout(plan.id)}
                    >
                      Get checkout link
                    </button>
                  ) : null}
                  {plan.status === "active" || plan.status === "past_due" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[#b45309] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                      onClick={() => void onCancel(plan.id)}
                    >
                      Cancel plan
                    </button>
                  ) : null}
                </div>
                {url ? (
                  <p className="mt-2 break-all text-[12px] text-[var(--admin-blue)]">{url}</p>
                ) : null}
                {error ? <p className="mt-2 text-[12px] text-[#b45309]">{error}</p> : null}
                {plan.planType === "hosting" ? (
                  <DomainField
                    plan={plan}
                    draft={domainDrafts.get(plan.id) ?? plan.domain ?? ""}
                    busy={domainBusyId === plan.id}
                    status={domainStatus.get(plan.id)}
                    error={domainError.get(plan.id)}
                    onDraftChange={(value) => setDomainDrafts((current) => new Map(current).set(plan.id, value))}
                    onSave={() => void onSaveDomain(plan.id)}
                    onCheck={() => void onCheckDomain(plan.id)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DomainField({
  plan,
  draft,
  busy,
  status,
  error,
  onDraftChange,
  onSave,
  onCheck,
}: {
  plan: ServicePlan;
  draft: string;
  busy: boolean;
  status: DomainAvailability | undefined;
  error: string | undefined;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCheck: () => void;
}) {
  const dirty = draft.trim().toLowerCase() !== (plan.domain ?? "");
  return (
    <div className="mt-3 border-t border-[var(--admin-line)] pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Domain</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          value={draft}
          disabled={busy}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="example.com"
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          className="h-9 rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
          onClick={onCheck}
        >
          Check availability
        </button>
        {dirty ? (
          <button
            type="button"
            disabled={busy}
            className="h-9 rounded-lg bg-[var(--admin-navy)] px-2.5 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
            onClick={onSave}
          >
            Save
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
        Reference only — nothing is registered here. Check with your registrar before relying on this.
      </p>
      {status ? <p className={`mt-1 text-[12px] font-semibold ${availabilityClass[status]}`}>{availabilityLabel[status]}</p> : null}
      {error ? <p className="mt-1 text-[12px] text-[#b45309]">{error}</p> : null}
    </div>
  );
}
