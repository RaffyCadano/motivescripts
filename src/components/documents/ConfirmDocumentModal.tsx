import { adminDangerSolidBtn, adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { ReactNode } from "react";

type ConfirmDocumentModalProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  actionLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  tone?: "admin" | "client";
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDocumentModal({
  open,
  title,
  description,
  actionLabel,
  cancelLabel = "Go back",
  busy,
  danger = false,
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
          {typeof description === "string" ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--client-muted)]">{description}</p>
          ) : (
            <div className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">{description}</div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] px-4 font-heading text-sm font-semibold"
              onClick={onClose}
            >
              {cancelLabel}
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
      <form
        className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onConfirm();
        }}
      >
        <button
          type="button"
          disabled={busy}
          className={`${adminGhostBtn} justify-center`}
          onClick={() => {
            if (!busy) onClose();
          }}
        >
          {cancelLabel}
        </button>
        <button type="submit" disabled={busy} className={`${danger ? adminDangerSolidBtn : adminPrimaryBtn} justify-center`}>
          {busy ? "Working…" : actionLabel}
        </button>
      </form>
    </AdminDialog>
  );
}
