import { useState } from "react";
import { setTaskDeliverable } from "@/data/agencyRepository";
import type { AgencyDeliverable } from "@/data/files";
import type { AgencyTaskStatus } from "@/data/agencyProjects";
import { AgencyDbError } from "@/lib/dbErrors";

export function TaskDeliverableSection({
  taskId,
  deliverableId,
  taskStatus,
  deliverables,
}: {
  taskId: string;
  deliverableId: string | null;
  taskStatus: AgencyTaskStatus;
  deliverables: AgencyDeliverable[];
}) {
  const [linkedId, setLinkedId] = useState(deliverableId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(value: string) {
    const next = value || null;
    const previous = linkedId;
    setLinkedId(next);
    setBusy(true);
    setError(null);
    try {
      await setTaskDeliverable(taskId, next);
    } catch (caught) {
      setLinkedId(previous);
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update the linked deliverable.");
    } finally {
      setBusy(false);
    }
  }

  const linked = deliverables.find((item) => item.id === linkedId) ?? null;
  const mismatch = taskStatus === "Completed" && linked !== null && linked.status !== "Approved";

  return (
    <section className="mt-6">
      <h3 className="font-heading text-sm font-semibold">Linked deliverable</h3>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">
        Which deliverable does this task produce? Lets everyone see whether completed work actually has an approved
        deliverable behind it, not just a checked-off task.
      </p>
      <select
        value={linkedId ?? ""}
        disabled={busy || deliverables.length === 0}
        onChange={(event) => void onChange(event.target.value)}
        className="mt-2 h-9 w-full rounded-lg border border-[var(--admin-line)] bg-white px-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
      >
        <option value="">No linked deliverable</option>
        {deliverables.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.status})
          </option>
        ))}
      </select>
      {deliverables.length === 0 ? (
        <p className="mt-1 text-[11px] text-[var(--admin-muted)]">No deliverables on this project yet.</p>
      ) : null}
      {mismatch ? (
        <p className="mt-2 text-[12px] font-semibold text-[#b45309]">
          This task is marked Completed, but "{linked!.name}" is still {linked!.status}, not Approved.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-[#b45309]">{error}</p> : null}
    </section>
  );
}
