import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { FileTypeIcon } from "@/components/admin/projects/FileTypeIcon";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  currentVersion,
  deliverableStatuses,
  filterDeliverables,
  formatFileUpdated,
  sortDeliverables,
  versionLabel,
  type DeliverableStatus,
} from "@/data/files";
import { cn } from "@/lib/cn";

const statusFilters = ["All", ...deliverableStatuses] as const;

export function AdminFiles() {
  const { deliverables, projects, clients } = useLeads();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeliverableStatus | "All">("All");

  const visible = useMemo(
    () => sortDeliverables(filterDeliverables(deliverables, query, status, "All"), "updated"),
    [deliverables, query, status],
  );
  const inReview = deliverables.filter((item) => item.status === "In Review").length;
  const approved = deliverables.filter((item) => item.status === "Approved").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Files</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          Agency deliverables across projects. Open a file to manage versions in the project workspace.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Deliverables" value={deliverables.filter((item) => item.status !== "Archived").length} />
        <SummaryCard label="In Review" value={inReview} />
        <SummaryCard label="Approved" value={approved} />
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="sr-only">Search files</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files..."
            className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Deliverable status">
          {statusFilters.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={status === item}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 font-heading text-[12px] font-semibold",
                status === item
                  ? "bg-[var(--admin-navy)] text-white"
                  : "bg-white text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] hover:bg-[var(--admin-hover)]",
              )}
              onClick={() => setStatus(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {deliverables.length === 0 ? (
        <Empty title="No deliverables yet" body="Add a deliverable from a project’s Files tab." />
      ) : visible.length === 0 ? (
        <Empty
          title={query.trim() ? "No files match your search." : "No active deliverables."}
          body="Try a different name, file, or status filter."
        />
      ) : (
        <ul className="divide-y divide-[var(--admin-line)] overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
          {visible.map((item) => {
            const project = projects.find((project) => project.id === item.projectId);
            const client = project ? clients.find((entry) => entry.id === project.clientId) : null;
            const current = currentVersion(item);
            return (
              <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                    <FileTypeIcon fileType={current?.fileType ?? "Other"} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{item.name}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">
                      {client?.businessName ?? "Unknown client"}
                      <span aria-hidden="true"> · </span>
                      {project?.name ?? "Unknown project"}
                    </p>
                    <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                      {current ? `${versionLabel(current.versionNumber)} · ` : "No versions · "}
                      {item.versions.length} {item.versions.length === 1 ? "version" : "versions"}
                      <span aria-hidden="true"> · </span>
                      Updated {formatFileUpdated(item.updatedAt)}
                    </p>
                    <div className="mt-2">
                      <DeliverableStatusBadge status={item.status} />
                    </div>
                  </div>
                </div>
                <Link
                  to={`/admin/projects/${item.projectId}?tab=files&file=${item.id}`}
                  className="inline-flex h-9 shrink-0 items-center self-start rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] sm:self-center"
                >
                  View
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--admin-ink)]">{value}</p>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">{body}</p>
    </div>
  );
}
