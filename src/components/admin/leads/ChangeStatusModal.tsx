import { useEffect, useState } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { leadStatuses, type Lead, type LeadStatus } from "@/data/leads";

type ChangeStatusModalProps = {
  lead: Lead | null;
  onClose: () => void;
  onSave: (status: LeadStatus) => void;
};

export function ChangeStatusModal({ lead, onClose, onSave }: ChangeStatusModalProps) {
  const [status, setStatus] = useState<LeadStatus>("New");

  useEffect(() => {
    if (lead) setStatus(lead.status);
  }, [lead]);

  return (
    <AdminDialog
      open={Boolean(lead)}
      title="Change status"
      description={lead ? `Update the pipeline stage for ${lead.businessName}.` : undefined}
      onClose={onClose}
    >
      <fieldset>
        <legend className="sr-only">Lead status</legend>
        <div className="space-y-2">
          {leadStatuses.map((item) => (
            <label
              key={item}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-line)] px-3 py-2.5 text-sm text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            >
              <input type="radio" name="lead-status" checked={status === item} onChange={() => setStatus(item)} />
              {item}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white"
          onClick={() => onSave(status)}
        >
          Update status
        </button>
      </div>
    </AdminDialog>
  );
}
