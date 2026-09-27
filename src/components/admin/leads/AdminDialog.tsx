import { useEffect, useId, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type AdminDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
  /** Form dialogs: an icon in the header, and a footer that stays in view while the fields scroll. */
  icon?: LucideIcon;
  footer?: ReactNode;
  busy?: boolean;
  onClose: () => void;
};

export function AdminDialog({ open, title, description, children, size = "md", icon: Icon, footer, busy = false, onClose }: AdminDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      // A form opens on its first field. Focusing the last button instead scrolled a long form to the bottom,
      // hiding the title and the first fields. Dialogs with no fields (confirmations) still focus the main button.
      const field = panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)",
      );
      if (field) {
        field.focus({ preventScroll: true });
        return;
      }
      const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const primary = buttons && buttons.length > 0 ? buttons[buttons.length - 1] : null;
      primary?.focus({ preventScroll: true });
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="admin-theme fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]"
        aria-label="Close dialog"
        onClick={() => {
          if (!busyRef.current) onCloseRef.current();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-10 w-full border border-[var(--admin-line)] bg-white shadow-[0_24px_60px_rgb(7_17_31_/_0.18)]",
          footer
            ? "flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl"
            : "overflow-auto rounded-[var(--admin-radius)] p-5 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)] sm:p-6",
          size === "xl"
            ? "max-h-[min(46rem,calc(100svh-2rem))] max-w-4xl"
            : size === "lg"
              ? "max-h-[min(40rem,calc(100svh-2rem))] max-w-2xl"
              : "max-h-[min(40rem,calc(100svh-2rem))] max-w-lg",
        )}
      >
        {footer ? (
          <>
            <header className="flex items-start gap-3.5 border-b border-[var(--admin-line)] px-5 py-4 sm:px-6 sm:py-5">
              {Icon ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
                  <Icon size={19} strokeWidth={2} aria-hidden="true" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">
                  {title}
                </h2>
                {description ? (
                  <div id={descriptionId} className="mt-0.5 text-sm leading-relaxed text-[var(--admin-muted)]">
                    {typeof description === "string" ? <p className="whitespace-pre-line">{description}</p> : description}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                onClick={() => onCloseRef.current()}
                className="-mr-1.5 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)] disabled:opacity-50"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
            <footer className="flex flex-col-reverse gap-2 border-t border-[var(--admin-line)] bg-[var(--admin-bg)] px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </footer>
          </>
        ) : (
          <>
            <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-2 text-sm leading-relaxed text-[var(--admin-muted)]">
                {typeof description === "string" ? <p className="whitespace-pre-line">{description}</p> : description}
              </div>
            ) : null}
            <div className="mt-5">{children}</div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
