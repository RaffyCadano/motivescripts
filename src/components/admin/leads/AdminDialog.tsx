import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type AdminDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
  busy?: boolean;
  onClose: () => void;
};

export function AdminDialog({ open, title, description, children, size = "md", busy = false, onClose }: AdminDialogProps) {
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
      const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      const primary = buttons && buttons.length > 0 ? buttons[buttons.length - 1] : null;
      primary?.focus();
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
          "relative z-10 max-h-[min(40rem,calc(100svh-2rem))] w-full overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white p-5 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)] sm:p-6",
          size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">
          {title}
        </h2>
        {description ? (
          <div id={descriptionId} className="mt-2 text-sm leading-relaxed text-[var(--admin-muted)]">
            {typeof description === "string" ? <p className="whitespace-pre-line">{description}</p> : description}
          </div>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
