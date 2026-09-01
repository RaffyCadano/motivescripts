import { Link } from "react-router-dom";
import type { ClientAction } from "@/data/clientPortal";
import { cn } from "@/lib/cn";

type ClientActionCardProps = {
  action: ClientAction | null;
  loading?: boolean;
};

export function ClientActionCard({ action, loading = false }: ClientActionCardProps) {
  const needsAction = Boolean(action?.href && action.buttonLabel);
  const informational = action?.kind === "waiting_production" || action?.kind === "in_development";

  return (
    <section
      className={cn(
        "rounded-[var(--client-radius)] border bg-[var(--client-card)] p-5 md:p-6",
        needsAction && "border-[rgb(0_80_240_/_0.22)]",
        informational && "border-[rgb(16_185_129_/_0.22)]",
        !needsAction && !informational && "border-[var(--client-line)]",
      )}
    >
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Your Action</h2>
      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true" aria-live="polite">
          <div className="h-5 w-48 animate-pulse rounded bg-[var(--client-hover)]" />
          <div className="h-4 max-w-xl animate-pulse rounded bg-[var(--client-hover)]" />
        </div>
      ) : action ? (
        <>
          {action.eyebrow ? (
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">
              {action.eyebrow}
            </p>
          ) : null}
          <p
            className={cn(
              "font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]",
              action.eyebrow ? "mt-1" : "mt-3",
            )}
          >
            {action.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">{action.body}</p>
          {needsAction && action.href && action.buttonLabel ? (
            <div className="mt-5">
              <Link
                to={action.href}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white transition-colors hover:bg-[var(--client-bright)]"
              >
                {action.buttonLabel}
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-3 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
            Nothing needed from you right now
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
            We’ll notify you when the next step is ready.
          </p>
        </>
      )}
    </section>
  );
}
