import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type AdminDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "md" | "lg";
  busy?: boolean;
  onClose: () => void;
};

export function AdminDialog({ open, title, description, children, size = "md", busy = false, onClose }: AdminDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onClose();
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
  }, [busy, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="admin-theme fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]"
        aria-label="Close dialog"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative max-h-[min(40rem,calc(100svh-2rem))] w-full overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white p-5 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)] sm:p-6",
          size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-[var(--admin-muted)]">
            {description}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
