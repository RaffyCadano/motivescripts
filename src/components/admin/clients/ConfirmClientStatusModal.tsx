import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { AgencyClient, AgencyClientStatus } from "@/data/agencyClients";

type ConfirmClientStatusModalProps = {
  client: AgencyClient | null;
  nextStatus: AgencyClientStatus | null;
  onClose: () => void;
  onConfirm: () => void;
};

const copy: Record<AgencyClientStatus, { title: string; description: string; action: string }> = {
  Active: {
    title: "Reactivate this client?",
    description: "This client will appear as Active again. Nothing is deleted.",
    action: "Reactivate",
  },
  Inactive: {
    title: "Mark this client inactive?",
    description: "Use Inactive when work is paused. The record stays in the list and can be reactivated later.",
    action: "Mark Inactive",
  },
  Archived: {
    title: "Archive this client?",
    description: "Archived clients stay in the system for history. They are not deleted.",
    action: "Archive Client",
  },
};

export function ConfirmClientStatusModal({
  client,
  nextStatus,
  onClose,
  onConfirm,
}: ConfirmClientStatusModalProps) {
  const open = Boolean(client && nextStatus);
  const content = nextStatus ? copy[nextStatus] : null;

  return (
    <AdminDialog
      open={open}
      title={content?.title ?? "Update client"}
      description={content?.description}
      onClose={onClose}
    >
      {client ? (
        <p className="text-sm text-[var(--admin-muted)]">
          {client.businessName} · {client.contactName}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
          onClick={onConfirm}
        >
          {content?.action ?? "Confirm"}
        </button>
      </div>
    </AdminDialog>
  );
}
