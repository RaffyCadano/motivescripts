import { PauseCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatProjectDay } from "@/data/agencyProjects";

/** Shown to the client while their website is paused: what happened and the one thing that fixes it. */
export function ClientPausedBanner({ pausedAt }: { pausedAt: string }) {
  return (
    <section
      role="status"
      className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--client-radius)] border border-amber-300 bg-amber-50 p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <PauseCircle size={22} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-amber-950">Your website is paused</h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-950/80">
            Your free launch period ended and there isn’t an active Website Care plan, so we paused your website on{" "}
            {formatProjectDay(pausedAt)}. Choose a plan and we’ll bring it back online.
          </p>
        </div>
      </div>
      <Link
        to="/client/plans"
        className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
      >
        Choose a plan
      </Link>
    </section>
  );
}
