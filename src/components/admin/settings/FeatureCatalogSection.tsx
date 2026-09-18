import { useEffect, useMemo, useState } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { adminDangerBtn, adminGhostBtn, adminPrimaryBtn, adminSoftBtn } from "@/components/admin/adminActionStyles";
import {
  draftFromCatalogItem,
  emptyFeatureCatalogDraft,
  featureCatalogCategoryLabel,
  formatFeatureCatalogPrice,
  validateFeatureCatalogDraft,
  type FeatureCatalogCategory,
  type FeatureCatalogDraft,
  type FeatureCatalogItem,
} from "@/data/featureCatalog";
import {
  deleteFeatureCatalogItem,
  fetchFeatureCatalog,
  insertFeatureCatalogItem,
  setFeatureCatalogItemActive,
  updateFeatureCatalogItem,
} from "@/data/featureCatalogRepository";
import { centsInputValue, parseDollarsToCents } from "@/data/money";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type Filter = "all" | "page" | "feature" | "active" | "inactive";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "page", label: "Pages" },
  { id: "feature", label: "Features" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

export function FeatureCatalogSection() {
  const [items, setItems] = useState<FeatureCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ item: FeatureCatalogItem | null; draft: FeatureCatalogDraft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await fetchFeatureCatalog());
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load the feature catalog.");
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (filter === "page" || filter === "feature") return item.category === filter;
      if (filter === "active") return item.isActive;
      if (filter === "inactive") return !item.isActive;
      return true;
    });
  }, [items, filter]);

  function openCreate() {
    setFormError(null);
    setModal({ item: null, draft: emptyFeatureCatalogDraft });
  }

  function openEdit(item: FeatureCatalogItem) {
    setFormError(null);
    setModal({ item, draft: draftFromCatalogItem(item) });
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setFormError(null);
  }

  async function submitModal() {
    if (!modal || busy) return;
    const invalid = validateFeatureCatalogDraft(modal.draft);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (modal.item) {
        const nameChanged = modal.draft.name.trim() !== modal.item.name;
        await updateFeatureCatalogItem(modal.item.id, modal.draft, modal.item.slug, nameChanged);
      } else {
        await insertFeatureCatalogItem(modal.draft);
      }
      setModal(null);
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to save this item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: FeatureCatalogItem) {
    if (rowBusyId) return;
    setRowBusyId(item.id);
    setError(null);
    try {
      await setFeatureCatalogItemActive(item.id, !item.isActive);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this item.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function removeItem(item: FeatureCatalogItem) {
    if (rowBusyId) return;
    if (
      !window.confirm(
        `Delete "${item.name}" permanently? Past proposals and contracts that already used this item keep their own copy of the name and price, so this can't change historical records -- but consider Deactivate instead if you might want it back.`,
      )
    ) {
      return;
    }
    setRowBusyId(item.id);
    setError(null);
    try {
      await deleteFeatureCatalogItem(item.id);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this item.");
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">Feature Catalog</h2>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Manage the page and feature options clients choose from on their website scope form. Deactivating an item
            hides it from new selections but leaves it visible on scope forms and proposals that already used it.
          </p>
        </div>
        <button type="button" className={`${adminPrimaryBtn} justify-center`} onClick={openCreate}>
          + Add Item
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 font-heading text-[12px] font-semibold transition-colors",
              filter === option.id
                ? "bg-[var(--admin-navy)] text-white"
                : "border border-[var(--admin-line)] bg-white text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)]" />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No items in this view"
          body="Add a page or feature option, or switch filters to see existing items."
          action={
            <button type="button" className={`${adminPrimaryBtn} justify-center`} onClick={openCreate}>
              Add Item
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--admin-line)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--admin-bg)] text-[12px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Default Price</th>
                <th className="px-3 py-2">Sort</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {visible.map((item) => (
                <tr key={item.id} className={cn(!item.isActive && "opacity-60")}>
                  <td className="px-3 py-2.5 text-[var(--admin-muted)]">{featureCatalogCategoryLabel(item.category)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-[var(--admin-ink)]">{item.name}</p>
                    {item.description ? (
                      <p className="mt-0.5 max-w-sm truncate text-[12px] text-[var(--admin-muted)]">{item.description}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--admin-ink)]">{formatFeatureCatalogPrice(item.defaultPriceCents)}</td>
                  <td className="px-3 py-2.5 text-[var(--admin-muted)]">{item.sortOrder}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold",
                        item.isActive ? "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]" : "bg-[var(--admin-bg)] text-[var(--admin-muted)]",
                      )}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className={`${adminGhostBtn} h-8 px-3 text-[12px]`} onClick={() => openEdit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={rowBusyId === item.id}
                        className={`${adminSoftBtn} h-8 px-3 text-[12px]`}
                        onClick={() => void toggleActive(item)}
                      >
                        {item.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={rowBusyId === item.id}
                        className={`${adminDangerBtn} h-8 px-3 text-[12px]`}
                        onClick={() => void removeItem(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDialog
        open={Boolean(modal)}
        title={modal?.item ? `Edit ${modal.item.name}` : "Add Feature Catalog Item"}
        busy={busy}
        onClose={closeModal}
      >
        {modal ? (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-[var(--admin-ink)]">
              Name
              <input
                className={fieldClass}
                value={modal.draft.name}
                disabled={busy}
                onChange={(event) => setModal({ ...modal, draft: { ...modal.draft, name: event.target.value } })}
              />
            </label>

            <label className="block text-sm font-semibold text-[var(--admin-ink)]">
              Category
              <select
                className={fieldClass}
                value={modal.draft.category}
                disabled={busy}
                onChange={(event) =>
                  setModal({ ...modal, draft: { ...modal.draft, category: event.target.value as FeatureCatalogCategory } })
                }
              >
                <option value="page">Page</option>
                <option value="feature">Feature</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-[var(--admin-ink)]">
              Description
              <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Optional</span>
              <textarea
                rows={3}
                className={fieldClass}
                value={modal.draft.description}
                disabled={busy}
                onChange={(event) => setModal({ ...modal, draft: { ...modal.draft, description: event.target.value } })}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[var(--admin-ink)]">
                Default Price
                <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Optional</span>
                <input
                  inputMode="decimal"
                  className={fieldClass}
                  disabled={busy}
                  value={modal.draft.defaultPriceCents == null ? "" : centsInputValue(modal.draft.defaultPriceCents)}
                  placeholder="0.00"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw.trim()) {
                      setModal({ ...modal, draft: { ...modal.draft, defaultPriceCents: null } });
                      return;
                    }
                    const next = parseDollarsToCents(raw);
                    if (next == null) return;
                    setModal({ ...modal, draft: { ...modal.draft, defaultPriceCents: next } });
                  }}
                />
              </label>

              <label className="block text-sm font-semibold text-[var(--admin-ink)]">
                Sort Order
                <input
                  type="number"
                  className={fieldClass}
                  disabled={busy}
                  value={modal.draft.sortOrder}
                  onChange={(event) =>
                    setModal({ ...modal, draft: { ...modal.draft, sortOrder: Number(event.target.value) } })
                  }
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
              <input
                type="checkbox"
                checked={modal.draft.isActive}
                disabled={busy}
                onChange={(event) => setModal({ ...modal, draft: { ...modal.draft, isActive: event.target.checked } })}
              />
              Active (selectable on new scope forms)
            </label>

            {formError ? <p className="text-sm text-red-700">{formError}</p> : null}

            <div className="flex justify-end gap-2 border-t border-[var(--admin-line)] pt-4">
              <button type="button" className={adminGhostBtn} disabled={busy} onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className={adminPrimaryBtn} disabled={busy} onClick={() => void submitModal()}>
                {busy ? "Saving…" : modal.item ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </div>
        ) : null}
      </AdminDialog>
    </section>
  );
}
