import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Shared look for the fields inside the redesigned admin form dialogs. */
export const dialogInputClass =
  "mt-1.5 h-11 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3.5 text-sm text-[var(--admin-ink)] shadow-[0_1px_0_rgb(7_17_31_/_0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-muted)] hover:border-[#c7d0dd] focus:border-[rgb(0_80_240_/_0.55)] focus:ring-4 focus:ring-[rgb(0_80_240_/_0.1)] disabled:bg-[var(--admin-bg)] disabled:text-[var(--admin-muted)]";

export const dialogTextareaClass =
  "mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--admin-ink)] shadow-[0_1px_0_rgb(7_17_31_/_0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-muted)] hover:border-[#c7d0dd] focus:border-[rgb(0_80_240_/_0.55)] focus:ring-4 focus:ring-[rgb(0_80_240_/_0.1)]";

/** A labelled field: label on top, optional "Required" mark, control, then an optional hint underneath. */
export function DialogField({
  label,
  required = false,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="flex items-baseline gap-1 text-[13px] font-semibold text-[var(--admin-ink)]">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-[#b42318]">
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-[12px] leading-snug text-[var(--admin-muted)]">{hint}</span> : null}
    </label>
  );
}

/** A select with the app's own chevron instead of each browser's default arrow. */
export function DialogSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative mt-1.5 block">
      <select {...props} className={cn(dialogInputClass, "mt-0 appearance-none pr-10", className)}>
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--admin-muted)]"
      />
    </span>
  );
}

/** One group of related fields, with a small heading, so a long form reads as a few clear steps. */
export function DialogSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-[var(--admin-line)] pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--admin-bg)] text-[var(--admin-muted)]">
            <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="font-heading text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">{title}</h3>
          {description ? <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Cancel and the main action, for the footer of a form dialog. The main button submits the form named by formId. */
export function DialogActions({
  formId,
  submitLabel,
  onCancel,
  busy = false,
  disabled = false,
}: {
  formId: string;
  submitLabel: string;
  onCancel: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] transition-colors hover:bg-[var(--admin-hover)] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form={formId}
        disabled={busy || disabled}
        className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-5 font-heading text-sm font-semibold text-white transition-colors hover:bg-[var(--admin-bright)] disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </>
  );
}
