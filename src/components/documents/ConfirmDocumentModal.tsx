import { AdminDialog } from "@/components/admin/leads/AdminDialog";

type ConfirmDocumentModalProps = {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  busy?: boolean;
  tone?: "admin" | "client";
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDocumentModal({
  open,
  title,
  description,
  actionLabel,
  busy,
  tone = "admin",
  onClose,
  onConfirm,
}: ConfirmDocumentModalProps) {
  if (tone === "client") {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
        <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]" aria-label="Close" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white p-5 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">{description}</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] px-4 font-heading text-sm font-semibold"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
              onClick={onConfirm}
            >
              {busy ? "Working…" : actionLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminDialog open={open} busy={busy} title={title} description={description} onClose={onClose}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          onClick={onConfirm}
        >
          {busy ? "Working…" : actionLabel}
        </button>
      </div>
    </AdminDialog>
  );
}
