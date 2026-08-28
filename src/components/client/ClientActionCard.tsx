import { Link } from "react-router-dom";
import type { ClientAction } from "@/data/clientPortal";
import { cn } from "@/lib/cn";

type ClientActionCardProps = {
  action: ClientAction;
};

export function ClientActionCard({ action }: ClientActionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--client-radius)] border bg-[var(--client-card)] p-5 md:p-6",
        action ? "border-[rgb(0_80_240_/_0.22)]" : "border-[var(--client-line)]",
      )}
    >
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Your Action</h2>
      {action ? (
        <>
          <p className="mt-3 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
            {action.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">{action.body}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              to={action.reviewHref}
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white transition-colors hover:bg-[var(--client-bright)]"
            >
              Review
            </Link>
            {action.canApprove ? (
              <Link
                to={action.reviewHref}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] transition-colors hover:border-[rgb(0_80_240_/_0.35)] hover:bg-[var(--client-hover)]"
              >
                Approve
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
            Nothing needed from you right now.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
            We’ll let you know when your next review is ready.
          </p>
        </>
      )}
    </section>
  );
}
