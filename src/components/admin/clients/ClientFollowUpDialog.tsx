import { Link } from "react-router-dom";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";

type ClientFollowUpDialogProps = {
  open: boolean;
  title: string;
  description: string;
  to: string;
  actionLabel: string;
  onClose: () => void;
};

export function ClientFollowUpDialog({
  open,
  title,
  description,
  to,
  actionLabel,
  onClose,
}: ClientFollowUpDialogProps) {
  return (
    <AdminDialog open={open} title={title} description={description} onClose={onClose}>
      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onClose}
        >
          Close
        </button>
        <Link
          to={to}
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
          onClick={onClose}
        >
          {actionLabel}
        </Link>
      </div>
    </AdminDialog>
  );
}
