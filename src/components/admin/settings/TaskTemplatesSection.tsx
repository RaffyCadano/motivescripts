import { useEffect, useMemo, useState } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { adminDangerBtn, adminGhostBtn, adminPrimaryBtn, adminSoftBtn } from "@/components/admin/adminActionStyles";
import {
  draftFromTaskTemplate,
  emptyTaskTemplateDraft,
  PRODUCTION_SCOPE_KEYS,
  scopeKeyLabel,
  TASK_TEMPLATE_MILESTONE_KEYS,
  taskTemplateMilestoneLabel,
  validateChecklistItemDraft,
  validateTaskTemplateDraft,
  type TaskTemplateChecklistItem,
  type TaskTemplateChecklistItemDraft,
  type TaskTemplateDraft,
  type TaskTemplateItem,
  type TaskTemplateMilestoneKey,
} from "@/data/taskTemplates";
import {
  addTaskTemplateChecklistItem,
  deleteTaskTemplate,
  deleteTaskTemplateChecklistItem,
  fetchTaskTemplateChecklistItems,
  fetchTaskTemplates,
  insertTaskTemplate,
  reorderTaskTemplateChecklistItems,
  setTaskTemplateActive,
  updateTaskTemplate,
  updateTaskTemplateChecklistItem,
} from "@/data/taskTemplatesRepository";
import { TASK_RECOMMENDED_ROLE_OPTIONS, type TaskRecommendedRoleId } from "@/data/taskRecommendedRoles";
import { TASK_TYPES, taskTypeLabel, type TaskType } from "@/data/taskTypes";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type Filter = "all" | "active" | "inactive";
type RoleFilter = "all" | "none" | TaskRecommendedRoleId;

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)]";

export function TaskTemplatesSection() {
  const [items, setItems] = useState<TaskTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [modal, setModal] = useState<{ item: TaskTemplateItem | null; draft: TaskTemplateDraft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      setItems(await fetchTaskTemplates());
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load task templates.");
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (filter === "active" && !item.isActive) return false;
      if (filter === "inactive" && item.isActive) return false;
      if (roleFilter === "none" && item.recommendedRole !== null) return false;
      if (roleFilter !== "all" && roleFilter !== "none" && item.recommendedRole !== roleFilter) return false;
      return true;
    });
  }, [items, filter, roleFilter]);

  function openCreate() {
    setFormError(null);
    setModal({ item: null, draft: emptyTaskTemplateDraft });
  }

  function openEdit(item: TaskTemplateItem) {
    setFormError(null);
    setModal({ item, draft: draftFromTaskTemplate(item) });
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setFormError(null);
  }

  async function submitModal() {
    if (!modal || busy) return;
    const invalid = validateTaskTemplateDraft(modal.draft);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (modal.item) {
        const titleChanged = modal.draft.title.trim() !== modal.item.title;
        await updateTaskTemplate(modal.item.id, modal.draft, modal.item.slug, titleChanged);
      } else {
        await insertTaskTemplate(modal.draft);
      }
      setModal(null);
      await reload();
    } catch (caught) {
      setFormError(caught instanceof AgencyDbError ? caught.message : "Unable to save this task template.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: TaskTemplateItem) {
    if (rowBusyId) return;
    if (item.isActive && item.scopeKeys.length > 0) {
      const proceed = window.confirm(
        `"${item.title}" is triggered by ${item.scopeKeys.length} scope item${item.scopeKeys.length === 1 ? "" : "s"}. Deactivating it means new projects that purchase ${item.scopeKeys.length === 1 ? "that item" : "those items"} will not receive this task. Existing tasks already generated are not affected. Continue?`,
      );
      if (!proceed) return;
    }
    setRowBusyId(item.id);
    setError(null);
    try {
      await setTaskTemplateActive(item.id, !item.isActive);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this task template.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function removeItem(item: TaskTemplateItem) {
    if (rowBusyId) return;
    if (
      !window.confirm(
        `Delete "${item.title}" permanently? Tasks already generated from this template keep their own copy of everything, so this can't change existing projects -- but consider Deactivate instead if you might want it back.`,
      )
    ) {
      return;
    }
    setRowBusyId(item.id);
    setError(null);
    try {
      await deleteTaskTemplate(item.id);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this task template.");
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">Task Templates</h2>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            These are the production tasks generated automatically once a client's invoice is paid. Changes apply to
            future production plans only -- tasks already created on existing projects are never changed.
          </p>
        </div>
        <button type="button" className={`${adminPrimaryBtn} justify-center`} onClick={openCreate}>
          + New Task Template
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(["all", "active", "inactive"] as Filter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 font-heading text-[12px] font-semibold capitalize transition-colors",
              filter === option
                ? "bg-[var(--admin-navy)] text-white"
                : "border border-[var(--admin-line)] bg-white text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]",
            )}
          >
            {option}
          </button>
        ))}

        <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--admin-ink)]">
          Role
          <select
            className="h-8 rounded-full border border-[var(--admin-line)] bg-white px-2.5 text-[12px] font-semibold text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
          >
            <option value="all">All roles</option>
            {TASK_RECOMMENDED_ROLE_OPTIONS.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
            <option value="none">No role set</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-bg)]" />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No templates in this view"
          body="Add a task template, or switch filters to see existing ones."
          action={
            <button type="button" className={`${adminPrimaryBtn} justify-center`} onClick={openCreate}>
              New Task Template
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--admin-line)]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[var(--admin-bg)] text-[12px] font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
              <tr>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Milestone</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {visible.map((item) => (
                <tr key={item.id} className={cn(!item.isActive && "opacity-60")}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-[var(--admin-ink)]">{item.title}</p>
                    {item.scopeKeys.length > 0 ? (
                      <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                        Triggered by: {item.scopeKeys.map(scopeKeyLabel).join(", ")}
                        {item.requiresContentScope ? " (+ written content)" : ""}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">Always generated</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--admin-muted)]">{taskTemplateMilestoneLabel(item.milestoneKey)}</td>
                  <td className="px-3 py-2.5 text-[var(--admin-muted)]">
                    {TASK_RECOMMENDED_ROLE_OPTIONS.find((role) => role.id === item.recommendedRole)?.label ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--admin-muted)]">{taskTypeLabel(item.taskType)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 font-heading text-xs font-semibold",
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
        title={modal?.item ? `Edit ${modal.item.title}` : "New Task Template"}
        size="lg"
        busy={busy}
        onClose={closeModal}
      >
        {modal ? (
          <TaskTemplateForm
            templateId={modal.item?.id ?? null}
            draft={modal.draft}
            busy={busy}
            formError={formError}
            onChange={(draft) => setModal({ ...modal, draft })}
            onCancel={closeModal}
            onSubmit={() => void submitModal()}
          />
        ) : null}
      </AdminDialog>
    </section>
  );
}

function TaskTemplateForm({
  templateId,
  draft,
  busy,
  formError,
  onChange,
  onCancel,
  onSubmit,
}: {
  templateId: string | null;
  draft: TaskTemplateDraft;
  busy: boolean;
  formError: string | null;
  onChange: (draft: TaskTemplateDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  function toggleScopeKey(key: string) {
    const has = draft.scopeKeys.includes(key);
    onChange({ ...draft, scopeKeys: has ? draft.scopeKeys.filter((item) => item !== key) : [...draft.scopeKeys, key] });
  }

  return (
    <div className="space-y-5">
      <label className="block text-sm font-semibold text-[var(--admin-ink)]">
        Task title
        <input className={fieldClass} value={draft.title} disabled={busy} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
      </label>

      <label className="block text-sm font-semibold text-[var(--admin-ink)]">
        Description
        <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Short summary shown in the list</span>
        <textarea
          rows={2}
          className={fieldClass}
          value={draft.description}
          disabled={busy}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>

      <label className="block text-sm font-semibold text-[var(--admin-ink)]">
        Instructions
        <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Optional -- shown to whoever works this task</span>
        <textarea
          rows={6}
          className={fieldClass}
          value={draft.instructions}
          disabled={busy}
          onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-[var(--admin-ink)]">
          Milestone
          <select
            className={fieldClass}
            value={draft.milestoneKey}
            disabled={busy}
            onChange={(event) => onChange({ ...draft, milestoneKey: event.target.value as TaskTemplateMilestoneKey })}
          >
            {TASK_TEMPLATE_MILESTONE_KEYS.map((key) => (
              <option key={key} value={key}>
                {taskTemplateMilestoneLabel(key)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[var(--admin-ink)]">
          Task type
          <select
            className={fieldClass}
            value={draft.taskType}
            disabled={busy}
            onChange={(event) => onChange({ ...draft, taskType: event.target.value as TaskType })}
          >
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {taskTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[var(--admin-ink)]">
          Recommended role
          <select
            className={fieldClass}
            value={draft.recommendedRole ?? ""}
            disabled={busy}
            onChange={(event) => onChange({ ...draft, recommendedRole: (event.target.value || null) as TaskRecommendedRoleId | null })}
          >
            <option value="">None</option>
            {TASK_RECOMMENDED_ROLE_OPTIONS.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-[var(--admin-ink)]">
          Estimated hours
          <span className="ml-1.5 text-xs font-normal text-[var(--admin-muted)]">Optional</span>
          <input
            type="number"
            min={0}
            step="0.5"
            className={fieldClass}
            disabled={busy}
            value={draft.estimatedHours ?? ""}
            onChange={(event) => onChange({ ...draft, estimatedHours: event.target.value === "" ? null : Number(event.target.value) })}
          />
        </label>

        <label className="block text-sm font-semibold text-[var(--admin-ink)]">
          Sort order
          <input
            type="number"
            className={fieldClass}
            disabled={busy}
            value={draft.sortOrder}
            onChange={(event) => onChange({ ...draft, sortOrder: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
          <input type="checkbox" checked={draft.isActive} disabled={busy} onChange={(event) => onChange({ ...draft, isActive: event.target.checked })} />
          Active (generated for new production plans)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
          <input type="checkbox" checked={draft.isRequired} disabled={busy} onChange={(event) => onChange({ ...draft, isRequired: event.target.checked })} />
          Required
          <span className="text-xs font-normal text-[var(--admin-muted)]">(display only -- does not affect workflow gates)</span>
        </label>
      </div>

      <div className="rounded-lg border border-[var(--admin-line)] p-4">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Scope trigger</p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          Which purchased scope items generate this task. Leave everything unchecked to always generate it.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {PRODUCTION_SCOPE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-[var(--admin-ink)]">
              <input type="checkbox" checked={draft.scopeKeys.includes(key)} disabled={busy} onChange={() => toggleScopeKey(key)} />
              {scopeKeyLabel(key)}
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
          <input
            type="checkbox"
            checked={draft.requiresContentScope}
            disabled={busy}
            onChange={(event) => onChange({ ...draft, requiresContentScope: event.target.checked })}
          />
          Also requires: client purchased written content services
        </label>
      </div>

      {templateId ? <ChecklistManager templateId={templateId} busy={busy} /> : null}

      {formError ? <p className="text-sm text-red-700">{formError}</p> : null}

      <div className="flex justify-end gap-2 border-t border-[var(--admin-line)] pt-4">
        <button type="button" className={adminGhostBtn} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={adminPrimaryBtn} disabled={busy} onClick={onSubmit}>
          {busy ? "Saving…" : templateId ? "Save Changes" : "Create Template"}
        </button>
      </div>
    </div>
  );
}

function ChecklistManager({ templateId, busy }: { templateId: string; busy: boolean }) {
  const [items, setItems] = useState<TaskTemplateChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  async function reload() {
    try {
      setItems(await fetchTaskTemplateChecklistItems(templateId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load the checklist.");
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  async function addItem() {
    const draft: TaskTemplateChecklistItemDraft = { title: newTitle, description: "" };
    const invalid = validateChecklistItemDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    try {
      await addTaskTemplateChecklistItem(templateId, draft, items.length);
      setNewTitle("");
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to add this checklist item.");
    }
  }

  async function saveEdit(id: string) {
    const invalid = validateChecklistItemDraft({ title: editingTitle, description: "" });
    if (invalid) {
      setError(invalid);
      return;
    }
    setRowBusyId(id);
    try {
      await updateTaskTemplateChecklistItem(id, { title: editingTitle, description: "" });
      setEditingId(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this checklist item.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function removeItem(id: string) {
    setRowBusyId(id);
    try {
      await deleteTaskTemplateChecklistItem(id);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this checklist item.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await reorderTaskTemplateChecklistItems(next.map((item) => item.id));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to reorder the checklist.");
      await reload();
    }
  }

  return (
    <div className="rounded-lg border border-[var(--admin-line)] p-4">
      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Checklist</p>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
        Copied onto each new task generated from this template. Editing it later never changes tasks already created.
      </p>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : items.length === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--admin-muted)]">No checklist items yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 rounded-lg border border-[var(--admin-line)] px-2.5 py-1.5">
              {editingId === item.id ? (
                <>
                  <input
                    className={`${fieldClass} mt-0 flex-1`}
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                  />
                  <button type="button" className={`${adminGhostBtn} h-8 px-2 text-[12px]`} onClick={() => void saveEdit(item.id)} disabled={rowBusyId === item.id}>
                    Save
                  </button>
                  <button type="button" className={`${adminGhostBtn} h-8 px-2 text-[12px]`} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-[var(--admin-ink)]">{item.title}</span>
                  <button type="button" className={`${adminGhostBtn} h-8 px-2 text-[12px]`} disabled={index === 0} onClick={() => void move(index, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`${adminGhostBtn} h-8 px-2 text-[12px]`}
                    disabled={index === items.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${adminGhostBtn} h-8 px-2 text-[12px]`}
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingTitle(item.title);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${adminDangerBtn} h-8 px-2 text-[12px]`}
                    disabled={rowBusyId === item.id}
                    onClick={() => void removeItem(item.id)}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <input
          className={`${fieldClass} mt-0 flex-1`}
          placeholder="Add checklist item"
          value={newTitle}
          disabled={busy}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addItem();
            }
          }}
        />
        <button type="button" className={`${adminGhostBtn} h-9 px-3 text-[12px]`} onClick={() => void addItem()} disabled={busy}>
          + Add
        </button>
      </div>
    </div>
  );
}
