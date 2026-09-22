import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useClientProjects } from "@/components/admin/leads/LeadsProvider";
import {
  SERVICE_PLAN_STATUS_LABELS,
  SERVICE_PLAN_TYPE_LABELS,
  canPausePlan,
  canResumePausedPlan,
  type DomainAvailability,
  type ServicePlan,
  type ServicePlanType,
} from "@/data/servicePlans";
import {
  cancelServicePlan,
  undoServicePlanCancellation,
  checkDomainAvailability,
  createServicePlan,
  createServicePlanCheckoutUrl,
  createServicePlanFromTemplate,
  listServicePlans,
  pauseServicePlan,
  resumeServicePlan,
  setServicePlanDomain,
} from "@/data/servicePlansRepository";
import type { MaintenancePlanTemplate } from "@/data/maintenancePlanTemplates";
import { listActiveMaintenancePlanTemplates } from "@/data/maintenancePlanTemplatesRepository";
import { formatUsdFromCents, parseDollarsToCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";
import type { AgencyClient } from "@/data/agencyClients";
import { scheduledEnd } from "@/data/clientPlanOffer";
import { adminCancelOptions } from "@/data/servicePlans";

const PLAN_TYPES: ServicePlanType[] = ["care", "seo_retainer", "hosting", "custom"];

const statusBadgeClass: Record<ServicePlan["status"], string> = {
  pending: "border-[var(--admin-line)] text-[var(--admin-muted)]",
  active: "border-emerald-700/40 bg-[rgb(16_185_129_/_0.1)] text-emerald-800",
  past_due: "border-amber-700/40 bg-[rgb(217_119_6_/_0.1)] text-amber-800",
  canceled: "border-[var(--admin-line)] text-[var(--admin-muted)]",
  paused: "border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
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
  // Cancelling stops a live Stripe subscription immediately and cannot be undone, so it takes a second click.
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Map<string, string>>(new Map());
  const [checkoutUrl, setCheckoutUrl] = useState<Map<string, string>>(new Map());
  const [domainDrafts, setDomainDrafts] = useState<Map<string, string>>(new Map());
  const [domainExpiresDrafts, setDomainExpiresDrafts] = useState<Map<string, string>>(new Map());
  const [sslExpiresDrafts, setSslExpiresDrafts] = useState<Map<string, string>>(new Map());
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

  const [templates, setTemplates] = useState<MaintenancePlanTemplate[]>([]);
  // "" = build a custom plan (the original flow); otherwise a maintenance_plan_templates id.
  const [templateId, setTemplateId] = useState("");

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

  useEffect(() => {
    listActiveMaintenancePlanTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  async function onCreate() {
    setFormError(null);

    if (planType === "care" && selectedTemplate) {
      setCreating(true);
      try {
        await createServicePlanFromTemplate({
          clientId: client.id,
          projectId: projectId || null,
          templateId: selectedTemplate.id,
        });
        setTemplateId("");
        setProjectId("");
        setPlanType("care");
        setFormOpen(false);
        await reload();
      } catch (caught) {
        setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to assign this plan tier.");
      } finally {
        setCreating(false);
      }
      return;
    }

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

  async function onPauseToggle(planId: string, pause: boolean) {
    setBusyId(planId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      if (pause) await pauseServicePlan(planId);
      else await resumeServicePlan(planId);
      await reload();
    } catch (caught) {
      setRowError((current) =>
        new Map(current).set(
          planId,
          caught instanceof AgencyDbError ? caught.message : `Unable to ${pause ? "pause" : "resume"} this plan.`,
        ),
      );
    } finally {
      setBusyId(null);
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

  async function onUndoCancel(planId: string) {
    setBusyId(planId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      await undoServicePlanCancellation(planId);
      // Stripe confirms with an event a moment later; check now and again shortly.
      await reload();
      window.setTimeout(() => void reload(), 3000);
    } catch (caught) {
      setRowError((current) =>
        new Map(current).set(planId, caught instanceof AgencyDbError ? caught.message : "Unable to undo the cancellation."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onCancel(planId: string, when: "now" | "period_end") {
    setConfirmCancelId(null);
    setBusyId(planId);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      await cancelServicePlan(planId, when);
      await reload();
      if (when === "now") window.setTimeout(() => void reload(), 3000);
    } catch (caught) {
      setRowError((current) =>
        new Map(current).set(planId, caught instanceof AgencyDbError ? caught.message : "Unable to cancel this plan."),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveDomain(planId: string, plan: ServicePlan) {
    const draft = domainDrafts.get(planId) ?? "";
    const domainExpiresAt = domainExpiresDrafts.has(planId)
      ? domainExpiresDrafts.get(planId)!
      : plan.domainExpiresAt ?? "";
    const sslExpiresAt = sslExpiresDrafts.has(planId) ? sslExpiresDrafts.get(planId)! : plan.sslExpiresAt ?? "";
    setDomainBusyId(planId);
    setDomainError((current) => {
      const next = new Map(current);
      next.delete(planId);
      return next;
    });
    try {
      await setServicePlanDomain(planId, draft, { domainExpiresAt, sslExpiresAt });
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
                onChange={(event) => {
                  setPlanType(event.target.value as ServicePlanType);
                  setTemplateId("");
                }}
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
          </div>

          {planType === "care" ? (
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Website Care tier
              <select
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              >
                <option value="">Custom (build from scratch below)</option>
                {templates.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} — {formatUsdFromCents(tier.monthlyPriceCents)}/mo
                    {tier.includedHours > 0 ? `, ${tier.includedHours} hrs included` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedTemplate ? (
            <div className="rounded-lg border border-[var(--admin-line)] bg-white p-3 text-[12px] text-[var(--admin-muted)]">
              <p className="font-semibold text-[var(--admin-ink)]">
                {selectedTemplate.name} — {formatUsdFromCents(selectedTemplate.monthlyPriceCents)}/mo
              </p>
              {selectedTemplate.description ? <p className="mt-1">{selectedTemplate.description}</p> : null}
              {selectedTemplate.includedServices.length > 0 ? (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                  {selectedTemplate.includedServices.map((service) => (
                    <li key={service}>{service}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2">
                <Link to="/admin/maintenance-plans" className="text-[var(--admin-blue)] hover:underline">
                  Edit tiers
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
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
          )}
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
                      {plan.includedHoursMonthly > 0 ? ` · ${plan.includedHoursMonthly} hrs/mo included` : ""}
                    </p>
                    {plan.status === "paused" ? (
                      <p className="mt-0.5 text-[12px] font-semibold text-[var(--admin-blue)]">
                        Billing paused{plan.pausedAt ? ` since ${new Date(plan.pausedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}.
                      </p>
                    ) : null}
                    {scheduledEnd(plan) ? (
                      <p className="mt-0.5 text-[12px] font-semibold text-[#b45309]">
                        Canceling. Ends {new Date(scheduledEnd(plan) as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass[plan.status]}`}
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
                  {canPausePlan(plan) ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                      onClick={() => void onPauseToggle(plan.id, true)}
                    >
                      Pause
                    </button>
                  ) : null}
                  {canResumePausedPlan(plan) ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
                      onClick={() => void onPauseToggle(plan.id, false)}
                    >
                      Resume billing
                    </button>
                  ) : null}
                  {adminCancelOptions(plan).undo ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                      onClick={() => void onUndoCancel(plan.id)}
                    >
                      Undo cancellation
                    </button>
                  ) : null}
                  {adminCancelOptions(plan).now ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[#b45309] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                      onClick={() => setConfirmCancelId(plan.id)}
                    >
                      Cancel plan
                    </button>
                  ) : null}
                  {adminCancelOptions(plan).abandon ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="h-9 rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                      onClick={() => setConfirmCancelId(plan.id)}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                {confirmCancelId === plan.id ? (
                  <div
                    role="alertdialog"
                    aria-label={adminCancelOptions(plan).abandon ? `Confirm clearing ${plan.label}` : `Confirm canceling ${plan.label}`}
                    className="mt-3 rounded-lg border border-[rgb(217_119_6_/_0.4)] bg-[rgb(217_119_6_/_0.06)] p-3"
                  >
                    {adminCancelOptions(plan).abandon ? (
                      <>
                        <p className="text-[13px] font-semibold text-[var(--admin-ink)]">Clear &ldquo;{plan.label}&rdquo;?</p>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--admin-muted)]">
                          This plan never made it through checkout, so the client hasn&apos;t been charged. Clearing it just
                          removes it from their pending list -- they (or you) can start a new one anytime.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="h-9 rounded-lg bg-[#b45309] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
                            onClick={() => void onCancel(plan.id, "now")}
                          >
                            Yes, clear it
                          </button>
                          <button
                            type="button"
                            className="h-9 rounded-lg border border-[var(--admin-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                            onClick={() => setConfirmCancelId(null)}
                          >
                            Keep it pending
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-[13px] font-semibold text-[var(--admin-ink)]">Cancel &ldquo;{plan.label}&rdquo;?</p>
                        <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-[var(--admin-muted)]">
                          {adminCancelOptions(plan).atPeriodEnd ? (
                            <li>
                              <span className="font-semibold text-[var(--admin-ink)]">End at period end (recommended):</span>{" "}
                              the client keeps the service until the end of the period they&apos;ve already paid for and
                              isn&apos;t charged again. You can undo it until then.
                            </li>
                          ) : null}
                          <li>
                            <span className="font-semibold text-[var(--admin-ink)]">Cancel now:</span> billing stops
                            immediately in Stripe, the client is emailed, and this can&apos;t be undone. To start billing
                            again you&apos;d create a new plan and send a new checkout link.
                          </li>
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {adminCancelOptions(plan).atPeriodEnd ? (
                            <button
                              type="button"
                              disabled={busy}
                              className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
                              onClick={() => void onCancel(plan.id, "period_end")}
                            >
                              End at period end
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            className="h-9 rounded-lg bg-[#b45309] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
                            onClick={() => void onCancel(plan.id, "now")}
                          >
                            Cancel now
                          </button>
                          <button
                            type="button"
                            className="h-9 rounded-lg border border-[var(--admin-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                            onClick={() => setConfirmCancelId(null)}
                          >
                            Keep plan
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
                {url ? (
                  <p className="mt-2 break-all text-[12px] text-[var(--admin-blue)]">{url}</p>
                ) : null}
                {error ? <p className="mt-2 text-[12px] text-[#b45309]">{error}</p> : null}
                {plan.planType === "hosting" ? (
                  <DomainField
                    plan={plan}
                    draft={domainDrafts.get(plan.id) ?? plan.domain ?? ""}
                    domainExpiresDraft={domainExpiresDrafts.get(plan.id) ?? plan.domainExpiresAt ?? ""}
                    sslExpiresDraft={sslExpiresDrafts.get(plan.id) ?? plan.sslExpiresAt ?? ""}
                    busy={domainBusyId === plan.id}
                    status={domainStatus.get(plan.id)}
                    error={domainError.get(plan.id)}
                    onDraftChange={(value) => setDomainDrafts((current) => new Map(current).set(plan.id, value))}
                    onDomainExpiresChange={(value) => setDomainExpiresDrafts((current) => new Map(current).set(plan.id, value))}
                    onSslExpiresChange={(value) => setSslExpiresDrafts((current) => new Map(current).set(plan.id, value))}
                    onSave={() => void onSaveDomain(plan.id, plan)}
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
  domainExpiresDraft,
  sslExpiresDraft,
  busy,
  status,
  error,
  onDraftChange,
  onDomainExpiresChange,
  onSslExpiresChange,
  onSave,
  onCheck,
}: {
  plan: ServicePlan;
  draft: string;
  domainExpiresDraft: string;
  sslExpiresDraft: string;
  busy: boolean;
  status: DomainAvailability | undefined;
  error: string | undefined;
  onDraftChange: (value: string) => void;
  onDomainExpiresChange: (value: string) => void;
  onSslExpiresChange: (value: string) => void;
  onSave: () => void;
  onCheck: () => void;
}) {
  const dirty =
    draft.trim().toLowerCase() !== (plan.domain ?? "") ||
    domainExpiresDraft !== (plan.domainExpiresAt ?? "") ||
    sslExpiresDraft !== (plan.sslExpiresAt ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const domainOverdue = Boolean(plan.domainExpiresAt && plan.domainExpiresAt <= today);
  const sslOverdue = Boolean(plan.sslExpiresAt && plan.sslExpiresAt <= today);
  return (
    <div className="mt-3 border-t border-[var(--admin-line)] pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Domain</p>
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
      <p className="mt-1 text-xs text-[var(--admin-muted)]">
        Reference only — nothing is registered here. Check with your registrar before relying on this.
      </p>
      {status ? <p className={`mt-1 text-[12px] font-semibold ${availabilityClass[status]}`}>{availabilityLabel[status]}</p> : null}
      {error ? <p className="mt-1 text-[12px] text-[#b45309]">{error}</p> : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
          Domain renews
          <input
            type="date"
            value={domainExpiresDraft}
            disabled={busy}
            onChange={(event) => onDomainExpiresChange(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
          {domainOverdue ? <span className="mt-1 block text-xs font-semibold text-[#b42318]">Overdue</span> : null}
        </label>
        <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
          SSL certificate renews
          <input
            type="date"
            value={sslExpiresDraft}
            disabled={busy}
            onChange={(event) => onSslExpiresChange(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
          {sslOverdue ? <span className="mt-1 block text-xs font-semibold text-[#b42318]">Overdue</span> : null}
        </label>
      </div>
      <p className="mt-1.5 text-xs text-[var(--admin-muted)]">
        Optional. Set these to get a reminder 30 days before renewal, and a repeating one if it lapses. Leave blank if this
        host auto-renews and you don't need a reminder.
      </p>
    </div>
  );
}
