import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type ClientConfirmDialogProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ClientConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  busyLabel = "Working…",
  onConfirm,
  onCancel,
}: ClientConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const first = cancelRef.current;
      const last = confirmRef.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  return createPortal(
    <div className="client-theme fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]"
        aria-label="Close dialog"
        disabled={busy}
        onClick={busy ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-[24rem] rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white p-6 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
      >
        <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
          {title}
        </h2>
        <div id={bodyId} className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
          {body}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)] disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={cn(
              "inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-navy)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-ink)] disabled:opacity-60",
            )}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
