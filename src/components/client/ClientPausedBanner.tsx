import { PauseCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatProjectDay } from "@/data/agencyProjects";

/**
 * Shown to the client while their website is paused. When the free period ended, the fix is a Care plan; when
 * MotiveScripts paused it by hand, it says so (with the note we wrote) and points to Messages instead.
 */
export function ClientPausedBanner({ pausedAt, reason, note }: { pausedAt: string; reason?: string | null; note?: string | null }) {
  const manual = reason === "manual";
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
            {manual
              ? `We paused your website on ${formatProjectDay(pausedAt)}.`
              : `Your free launch period ended and there isn’t an active Website Care plan, so we paused your website on ${formatProjectDay(pausedAt)}. Choose a plan and we’ll bring it back online.`}
          </p>
          {manual && note?.trim() ? <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950">{note.trim()}</p> : null}
        </div>
      </div>
      <Link
        to={manual ? "/client/messages" : "/client/plans"}
        className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
      >
        {manual ? "Message us" : "Choose a plan"}
      </Link>
    </section>
  );
}
