import { Link } from "react-router-dom";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { Lead } from "@/data/leads";

type ConvertLeadModalProps = {
  lead: Lead | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConvertLeadModal({ lead, onClose, onConfirm }: ConvertLeadModalProps) {
  const alreadyConverted = Boolean(lead?.convertedClientId);

  return (
    <AdminDialog
      open={Boolean(lead)}
      title={alreadyConverted ? "Already converted" : "Convert this lead to a client?"}
      description={
        alreadyConverted
          ? "This lead already has a client record. A second client will not be created."
          : "This will create a client record using the lead’s contact and business information."
      }
      onClose={onClose}
    >
      {lead ? (
        <p className="text-sm text-[var(--admin-muted)]">
          {lead.businessName} · {lead.name}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onClose}
        >
          {alreadyConverted ? "Close" : "Cancel"}
        </button>
        {alreadyConverted && lead?.convertedClientId ? (
          <Link
            to={`/admin/clients/${lead.convertedClientId}`}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
            onClick={onClose}
          >
            View Client
          </Link>
        ) : (
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
            onClick={onConfirm}
          >
            Convert to Client
          </button>
        )}
      </div>
    </AdminDialog>
  );
}
