import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

type ClientRequestChangesDialogProps = {
  open: boolean;
  onCancel: () => void;
  onSubmit: (message: string) => void;
};

export function ClientRequestChangesDialog({ open, onCancel, onSubmit }: ClientRequestChangesDialogProps) {
  const titleId = useId();
  const fieldId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setMessage("");
      return;
    }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
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
  }, [onCancel, open]);

  if (!open) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return createPortal(
    <div className="client-theme fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]" aria-label="Close dialog" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[24rem] rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white p-6 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
      >
        <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
          Request changes
        </h2>
        <form className="mt-3" onSubmit={handleSubmit}>
          <p className="text-sm text-[var(--client-muted)]">Tell us what you’d like changed.</p>
          <label htmlFor={fieldId} className="mt-4 block font-heading text-sm font-semibold text-[var(--client-ink)]">
            What would you like us to change?
          </label>
          <textarea
            ref={textareaRef}
            id={fieldId}
            required
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-3 py-2.5 text-sm text-[var(--client-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim()}
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-navy)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-ink)] disabled:opacity-50"
            >
              Submit Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
