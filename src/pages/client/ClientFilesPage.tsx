import { Link } from "react-router-dom";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { FileTypeIcon } from "@/components/admin/projects/FileTypeIcon";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { currentVersion, versionLabel } from "@/data/files";
import { awaitingReview, canClientReview, clientReviewLabel, clientStatusTone } from "@/data/review";

export function ClientFilesPage() {
  const { files } = usePortalSession();
  const active = files.filter((item) => item.status !== "Archived");
  const waiting = awaitingReview(active);

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Files</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--client-muted)]">
          Review current deliverables. Approval and change requests apply only to the current version.
        </p>
        {waiting.length > 0 ? (
          <p className="mt-3 text-sm text-[var(--client-ink)]">You have {waiting.length} item{waiting.length === 1 ? "" : "s"} awaiting review.</p>
        ) : null}
      </header>

      {active.length === 0 ? (
        <p className="text-sm text-[var(--client-muted)]">No files are ready yet.</p>
      ) : (
        <ul className="space-y-4">
          {active.map((item) => {
            const current = currentVersion(item);
            const reviewable = canClientReview(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--client-hover)] text-[var(--client-blue)]">
                    <FileTypeIcon fileType={current?.fileType ?? "Other"} />
                  </span>
                  <div>
                    <p className="font-heading text-base font-semibold text-[var(--client-ink)]">{item.name}</p>
                    <p className="mt-1 text-[13px] text-[var(--client-muted)]">
                      {current ? versionLabel(current.versionNumber) : "No versions"}
                      <span aria-hidden="true"> · </span>
                      {clientReviewLabel(item.status)}
                    </p>
                    <div className="mt-2">
                      <ClientStatusBadge
                        label={clientReviewLabel(item.status)}
                        tone={clientStatusTone(item.status)}
                      />
                    </div>
                  </div>
                </div>
                <Link
                  to={`/client/files/${item.id}`}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
                >
                  {reviewable ? "Review" : "View"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
