import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  maintenancePlanTemplateDefaultPriorities,
  type MaintenancePlanTemplate,
  type MaintenancePlanTemplateInput,
} from "@/data/maintenancePlanTemplates";
import {
  createMaintenancePlanTemplate,
  listMaintenancePlanTemplates,
  reactivateMaintenancePlanTemplate,
  retireMaintenancePlanTemplate,
  updateMaintenancePlanTemplate,
} from "@/data/maintenancePlanTemplatesRepository";
import { centsInputValue, formatUsdFromCents, parseDollarsToCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";

const EMPTY_DRAFT: MaintenancePlanTemplateInput = {
  name: "",
  description: "",
  monthlyPriceCents: 0,
  includedHours: 0,
  includedServices: [],
  overageRateCents: null,
  defaultPriority: "Medium",
  fastMonitoring: false,
  reviewIncluded: false,
  seoIncluded: false,
  isActive: true,
  sortOrder: 0,
};

function draftFromTemplate(template: MaintenancePlanTemplate): MaintenancePlanTemplateInput {
  return {
    name: template.name,
    description: template.description,
    monthlyPriceCents: template.monthlyPriceCents,
    includedHours: template.includedHours,
    includedServices: template.includedServices,
    overageRateCents: template.overageRateCents,
    defaultPriority: template.defaultPriority,
    fastMonitoring: template.fastMonitoring,
    reviewIncluded: template.reviewIncluded,
    seoIncluded: template.seoIncluded,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
  };
}

export function AdminMaintenancePlanTemplates() {
  const { profile } = useAuth();
  const canManage = hasPermission(profile, "invoices.manage");

  const [rows, setRows] = useState<MaintenancePlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [overageInput, setOverageInput] = useState("");
  const [servicesInput, setServicesInput] = useState("");
  const [draft, setDraft] = useState<MaintenancePlanTemplateInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setRows(await listMaintenancePlanTemplates());
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load Website Care plan tiers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function openNew() {
    setDraft({ ...EMPTY_DRAFT, sortOrder: rows.length * 10 });
    setPriceInput("");
    setOverageInput("");
    setServicesInput("");
    setFormError(null);
    setEditingId("new");
  }

  function openEdit(template: MaintenancePlanTemplate) {
    setDraft(draftFromTemplate(template));
    setPriceInput(centsInputValue(template.monthlyPriceCents));
    setOverageInput(template.overageRateCents === null ? "" : centsInputValue(template.overageRateCents));
    setServicesInput(template.includedServices.join("\n"));
    setFormError(null);
    setEditingId(template.id);
  }

  function closeForm() {
    setEditingId(null);
    setFormError(null);
  }

  async function onSave() {
    setFormError(null);
    if (!draft.name.trim()) {
      setFormError("Enter a name for this tier.");
      return;
    }
    const priceCents = parseDollarsToCents(priceInput);
    if (priceCents === null || priceCents < 50) {
      setFormError("Enter a monthly price of at least $0.50.");
      return;
    }
    const overageCents = overageInput.trim() ? parseDollarsToCents(overageInput) : null;
    if (overageInput.trim() && (overageCents === null || overageCents < 0)) {
      setFormError("Enter a valid overage rate, or leave it blank.");
      return;
    }
    const services = servicesInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const payload: MaintenancePlanTemplateInput = {
      ...draft,
      monthlyPriceCents: priceCents,
      overageRateCents: overageCents,
      includedServices: services,
    };

    setSaving(true);
    try {
      if (editingId === "new") {
        await createMaintenancePlanTemplate(payload);
      } else if (editingId) {
        await updateMaintenancePlanTemplate(editingId, payload);
      }
      closeForm();
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to save this plan tier.");
    } finally {
      setSaving(false);
    }
  }

  async function onRetire(id: string) {
    if (!window.confirm("Retire this tier? It stays on any plan already assigned from it, but won't be offered for new plans.")) return;
    try {
      await retireMaintenancePlanTemplate(id);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to retire this tier.");
    }
  }

  async function onReactivate(id: string) {
    try {
      await reactivateMaintenancePlanTemplate(id);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to reactivate this tier.");
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Website Care plans"
        description="The maintenance-plan tiers clients subscribe to (Essential, Business, Pro, or whatever you call them). Edit freely -- changing a tier here never changes what an existing subscriber already agreed to."
        action={
          canManage ? (
            <button type="button" className={`${adminBlueBtn} justify-center`} onClick={openNew}>
              + Add tier
            </button>
          ) : undefined
        }
      />

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {editingId ? (
        <div className="space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">
            {editingId === "new" ? "New tier" : "Edit tier"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Name
              <input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Essential"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Monthly price (USD)
              <input
                inputMode="decimal"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                placeholder="49.00"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Included hours / month
              <input
                inputMode="decimal"
                value={draft.includedHours}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, includedHours: Number(event.target.value) || 0 }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Overage rate / hour (USD, optional)
              <input
                inputMode="decimal"
                value={overageInput}
                onChange={(event) => setOverageInput(event.target.value)}
                placeholder="90.00"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
            <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
              Default request priority
              <select
                value={draft.defaultPriority}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultPriority: event.target.value as MaintenancePlanTemplateInput["defaultPriority"],
                  }))
                }
                className="mt-1 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              >
                {maintenancePlanTemplateDefaultPriorities.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-[var(--admin-muted)]">
            A new Care request from a client on this tier starts at this priority in the admin queue -- staff can
            still change it by hand afterward. This is what makes "Priority support" real.
          </p>
          <div className="grid gap-2 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-[12px] font-semibold text-[var(--admin-ink)]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.fastMonitoring}
                onChange={(event) => setDraft((current) => ({ ...current, fastMonitoring: event.target.checked }))}
              />
              <span>
                Advanced monitoring
                <span className="mt-0.5 block text-[11px] font-normal text-[var(--admin-muted)]">
                  Checked every 5 minutes instead of ~15, and alerts after 2 slow checks instead of 4.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[12px] font-semibold text-[var(--admin-ink)]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.reviewIncluded}
                onChange={(event) => setDraft((current) => ({ ...current, reviewIncluded: event.target.checked }))}
              />
              <span>
                Monthly maintenance review
                <span className="mt-0.5 block text-[11px] font-normal text-[var(--admin-muted)]">
                  Auto-creates a recurring review task on the 1st of each month for a plan on this tier.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[12px] font-semibold text-[var(--admin-ink)]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.seoIncluded}
                onChange={(event) => setDraft((current) => ({ ...current, seoIncluded: event.target.checked }))}
              />
              <span>
                SEO maintenance
                <span className="mt-0.5 block text-[11px] font-normal text-[var(--admin-muted)]">
                  Auto-creates a recurring SEO review task on the 1st of each month, independent of the maintenance
                  review above.
                </span>
              </span>
            </label>
          </div>
          <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
            Description
            <textarea
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[var(--admin-muted)]">
            What's included (one per line)
            <textarea
              value={servicesInput}
              onChange={(event) => setServicesInput(event.target.value)}
              rows={5}
              placeholder={"Hosting\nSSL certificate\nUptime monitoring\nBackups"}
              className="mt-1 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          {formError ? <p className="text-[12px] text-[#b45309]">{formError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className="h-9 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
              onClick={() => void onSave()}
            >
              {editingId === "new" ? "Create tier" : "Save changes"}
            </button>
            <button type="button" className={adminGhostBtn} onClick={closeForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No plan tiers yet"
          body="Add a tier (Essential, Business, Pro -- or whatever fits your agency) so you can assign it to clients from their profile."
          action={
            canManage ? (
              <button type="button" className={`${adminBlueBtn} justify-center`} onClick={openNew}>
                Add tier
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((tier) => {
            const items: AdminActionsMenuItem[] = canManage
              ? [
                  { id: "edit", label: "Edit", icon: Pencil, onSelect: () => openEdit(tier) },
                  tier.isActive
                    ? { id: "retire", label: "Retire", icon: Trash2, onSelect: () => void onRetire(tier.id), danger: true }
                    : { id: "reactivate", label: "Reactivate", icon: RotateCcw, onSelect: () => void onReactivate(tier.id) },
                ]
              : [];
            return (
              <li key={tier.id} className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{tier.name}</p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-heading text-xs font-semibold ${
                          tier.isActive
                            ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]"
                            : "bg-[var(--admin-bg)] text-[var(--admin-muted)]"
                        }`}
                      >
                        {tier.isActive ? "Active" : "Retired"}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                      {formatUsdFromCents(tier.monthlyPriceCents)}/mo
                      {tier.includedHours > 0 ? ` · ${tier.includedHours} hrs/mo included` : ""}
                      {tier.overageRateCents !== null ? ` · ${formatUsdFromCents(tier.overageRateCents)}/hr overage` : ""}
                      {` · ${tier.defaultPriority} priority`}
                      {tier.fastMonitoring ? " · Advanced monitoring" : ""}
                      {tier.reviewIncluded ? " · Monthly review" : ""}
                      {tier.seoIncluded ? " · SEO review" : ""}
                    </p>
                    {tier.description ? <p className="mt-2 text-sm text-[var(--admin-ink)]">{tier.description}</p> : null}
                    {tier.includedServices.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {tier.includedServices.map((service) => (
                          <li
                            key={service}
                            className="rounded-full border border-[var(--admin-line)] bg-[var(--admin-bg)] px-2 py-0.5 text-[11px] text-[var(--admin-muted)]"
                          >
                            {service}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {items.length > 0 ? <AdminActionsMenu ariaLabel={`Actions for ${tier.name}`} iconOnly items={items} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
