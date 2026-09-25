import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A section of an admin form as a card: an icon, a title, a line of help, then the fields. */
export function AdminFormCard({
  icon: Icon,
  title,
  description,
  id,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Anchor, so a link like #project-development can scroll to this card. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
          <Icon size={18} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">{description}</p> : null}
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
