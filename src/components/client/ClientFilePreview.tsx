import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { ClientFile, FileVersion } from "@/data/clientPortal";

type ClientFilePreviewProps = {
  file: ClientFile;
  version: FileVersion;
  onClose: () => void;
};

export function ClientFilePreview({ file, version, onClose }: ClientFilePreviewProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
  }, [onClose]);

  return createPortal(
    <div className="client-theme fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(40rem,calc(100svh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--client-line)] px-5 py-4">
          <div>
            <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
              {file.name} — {version.label}
            </h2>
            <p className="mt-1 text-sm text-[var(--client-muted)]">{version.uploadedLabel}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--client-muted)] hover:bg-[var(--client-bg)] hover:text-[var(--client-ink)]"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-dashed border-[var(--client-line)] bg-[var(--client-bg)] px-6 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-[var(--client-muted)]">
              Preview for {file.name} {version.label}. File previews will open from storage once this portal is
              connected.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--client-line)] px-5 py-4 sm:flex-row sm:justify-end">
          {file.awaitingReview && version.status === "current" ? (
            <>
              <Link
                to="/client/feedback"
                className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
                onClick={onClose}
              >
                Leave Feedback
              </Link>
              <Link
                to="/client/approvals"
                className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
                onClick={onClose}
              >
                Approve Version
              </Link>
            </>
          ) : (
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
