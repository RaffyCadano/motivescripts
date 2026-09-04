import { useEffect, useState, type FormEvent } from "react";
import {
  addTaskChecklistItem,
  listTaskChecklistItems,
  removeTaskChecklistItem,
  setTaskChecklistItemDone,
} from "@/data/taskChecklistRepository";
import type { TaskChecklistItem } from "@/data/taskChecklist";
import { AgencyDbError } from "@/lib/dbErrors";

export function TaskChecklistSection({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [items, setItems] = useState<TaskChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listTaskChecklistItems(taskId)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load the checklist.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [taskId]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const item = await addTaskChecklistItem({ taskId, projectId, label: trimmed, position: items.length });
      setItems((current) => [...current, item]);
      setLabel("");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to add this item.");
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(item: TaskChecklistItem) {
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, done: !row.done } : row)));
    try {
      await setTaskChecklistItemDone(item.id, !item.done);
    } catch (caught) {
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, done: item.done } : row)));
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this item.");
    }
  }

  async function onRemove(id: string) {
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== id));
    try {
      await removeTaskChecklistItem(id);
    } catch (caught) {
      setItems(previous);
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove this item.");
    }
  }

  const done = items.filter((item) => item.done).length;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold">Checklist</h3>
        {items.length > 0 ? (
          <span className="text-[12px] text-[var(--admin-muted)]">
            {done}/{items.length}
          </span>
        ) : null}
      </div>
      {loading ? (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Loading…</p>
      ) : (
        <>
          {items.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => void onToggle(item)}
                    className="size-4 shrink-0 rounded border-[var(--admin-line)]"
                  />
                  <span className={`flex-1 text-sm ${item.done ? "text-[var(--admin-muted)] line-through" : "text-[var(--admin-ink)]"}`}>
                    {item.label}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[var(--admin-muted)] hover:text-[#b45309]"
                    onClick={() => void onRemove(item.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form className="mt-2 flex gap-2" onSubmit={(event) => void onAdd(event)}>
            <input
              value={label}
              disabled={busy}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Add a checklist item"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
            <button
              type="submit"
              disabled={busy || !label.trim()}
              className="h-9 shrink-0 rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {error ? <p className="mt-2 text-[12px] text-[#b45309]">{error}</p> : null}
        </>
      )}
    </section>
  );
}
