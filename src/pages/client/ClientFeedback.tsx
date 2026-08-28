import { Link } from "react-router-dom";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { versionLabel } from "@/data/files";
import { formatReviewLong } from "@/data/review";

export function ClientFeedback() {
  const { files, feedback } = usePortalSession();
  const open = feedback.filter((item) => item.status === "Open");
  const resolved = feedback.filter((item) => item.status === "Resolved");

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Feedback</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">Notes stay attached to the version you reviewed.</p>
      </header>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Open</h2>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">No open feedback.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {open.map((item) => {
              const deliverable = files.find((entry) => entry.id === item.deliverableId);
              const version = deliverable?.versions.find((entry) => entry.id === item.versionId);
              return (
                <li key={item.id}>
                  <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
                    {deliverable?.name ?? "Deliverable"} {version ? versionLabel(version.versionNumber) : ""}
                  </p>
                  <p className="mt-1 text-sm text-[var(--client-ink)]">“{item.message}”</p>
                  <p className="mt-1 text-[12px] text-[var(--client-muted)]">
                    {formatReviewLong(item.createdAt)} · Open
                  </p>
                  {deliverable ? (
                    <Link
                      to={`/client/files/${deliverable.id}`}
                      className="mt-2 inline-flex font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Resolved</h2>
        {resolved.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">No resolved feedback yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {resolved.map((item) => {
              const deliverable = files.find((entry) => entry.id === item.deliverableId);
              const version = deliverable?.versions.find((entry) => entry.id === item.versionId);
              return (
                <li key={item.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
                      {deliverable?.name ?? "Deliverable"} {version ? versionLabel(version.versionNumber) : ""}
                    </p>
                    <ClientStatusBadge label="Resolved" tone="done" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--client-ink)]">“{item.message}”</p>
                  <p className="mt-1 text-[12px] text-[var(--client-muted)]">
                    Resolved {item.resolvedAt ? formatReviewLong(item.resolvedAt) : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
