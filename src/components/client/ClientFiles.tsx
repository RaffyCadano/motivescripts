import { FileArchive, FileImage, LayoutTemplate } from "lucide-react";
import { Link } from "react-router-dom";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { currentVersion } from "@/data/files";
import { canClientReview, clientReviewLabel, clientStatusTone } from "@/data/review";

export function ClientFiles() {
  const { files } = usePortalSession();
  const recent = files.filter((item) => item.status !== "Archived").slice(0, 4);

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--client-line)] px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Recent Files</h2>
        <Link className="text-[12px] font-medium text-[var(--client-blue)] hover:underline" to="/client/files">
          View all
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="px-5 py-6">
          <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">No files yet</p>
          <p className="mt-1 text-sm text-[var(--client-muted)]">
            Deliverables will appear here when they are ready for your review.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--client-line)]">
          {recent.map((item) => {
            const current = currentVersion(item);
            const reviewable = canClientReview(item);
            return (
              <li key={item.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--client-hover)] text-[var(--client-blue)]">
                    {item.category === "Asset" ? (
                      <FileArchive size={18} strokeWidth={1.75} aria-hidden="true" />
                    ) : item.category === "Branding" ? (
                      <FileImage size={18} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <LayoutTemplate size={18} strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">{item.name}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--client-muted)]">
                          {current ? `Version ${current.versionNumber}` : "No version"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClientStatusBadge
                          label={clientReviewLabel(item.status)}
                          tone={clientStatusTone(item.status)}
                        />
                        <Link
                          to={`/client/files/${item.id}`}
                          className="inline-flex h-9 items-center rounded-lg border border-[var(--client-line)] bg-white px-3 font-heading text-[12px] font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
                        >
                          {reviewable ? "Review" : "View"}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
