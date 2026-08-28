import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { currentVersion, versionLabel } from "@/data/files";
import { awaitingReview, formatReviewLong } from "@/data/review";

export function ClientApprovals() {
  const { files, approvals } = usePortalSession();
  const waiting = awaitingReview(files.filter((item) => item.status !== "Archived"));

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Approvals</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          Approve the current version, or review what you’ve already signed off.
        </p>
      </header>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Awaiting Review</h2>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">Nothing waiting for review.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {waiting.map((item) => {
              const current = currentVersion(item);
              return (
                <li key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
                      {item.name} {current ? versionLabel(current.versionNumber) : ""}
                    </p>
                    <div className="mt-2">
                      <ClientStatusBadge label="Needs Review" tone="review" />
                    </div>
                  </div>
                  <Link
                    to={`/client/files/${item.id}`}
                    className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
                  >
                    Review
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Approved</h2>
        {approvals.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">No approvals yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {approvals.map((item) => {
              const deliverable = files.find((entry) => entry.id === item.deliverableId);
              const version = deliverable?.versions.find((entry) => entry.id === item.versionId);
              return (
                <li key={item.id} className="flex gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgb(16_185_129_/_0.12)] text-[#0f7a56]">
                    <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
                      {deliverable?.name ?? "Deliverable"} {version ? versionLabel(version.versionNumber) : ""}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--client-muted)]">
                      Approved {formatReviewLong(item.approvedAt)} · {item.approvedBy}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
