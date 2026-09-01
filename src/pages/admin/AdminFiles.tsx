import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminAttentionList } from "@/components/admin/list/AdminAttentionList";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { AdminStatusChips } from "@/components/admin/list/AdminStatusChips";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { FileTypeIcon } from "@/components/admin/projects/FileTypeIcon";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  currentVersion,
  deliverableCurrentVersionLabel,
  deliverableStatuses,
  deliverableUpdatedAt,
  earlierVersionCount,
  filterDeliverables,
  formatFileUpdatedLabel,
  sortDeliverables,
  type AgencyDeliverable,
  type DeliverableStatus,
} from "@/data/files";
const statusFilters = ["All", ...deliverableStatuses] as const;

type SummaryId = "All" | "In Review" | "Needs Changes" | "Approved";

type AdminFilesProps = {
  projectBasePath?: string;
  projectsHref?: string;
  restrictToProjectIds?: string[];
};

export function AdminFiles({
  projectBasePath = "/admin/projects",
  projectsHref = "/admin/projects",
  restrictToProjectIds,
}: AdminFilesProps) {
  const { deliverables, projects, clients } = useLeads();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeliverableStatus | "All">("All");
  const scopedDeliverables = restrictToProjectIds
    ? deliverables.filter((item) => restrictToProjectIds.includes(item.projectId))
    : deliverables;
  const hrefFor = (item: AgencyDeliverable) => fileHref(item, projectBasePath);

  const names = useMemo(() => {
    const projectName = (projectId: string) => projects.find((project) => project.id === projectId)?.name ?? "";
    const clientName = (projectId: string) => {
      const project = projects.find((item) => item.id === projectId);
      return project ? (clients.find((client) => client.id === project.clientId)?.businessName ?? "") : "";
    };
    return { projectName, clientName };
  }, [clients, projects]);

  const visible = useMemo(
    () => sortDeliverables(filterDeliverables(scopedDeliverables, query, status, "All", names), "updated"),
    [names, query, scopedDeliverables, status],
  );

  const activeCount = scopedDeliverables.filter((item) => item.status !== "Archived").length;
  const inReviewCount = scopedDeliverables.filter((item) => item.status === "In Review").length;
  const needsChangesCount = scopedDeliverables.filter((item) => item.status === "Needs Changes").length;
  const approvedCount = scopedDeliverables.filter((item) => item.status === "Approved").length;
  const searching = query.trim().length > 0 || status !== "All";

  const attention = useMemo(
    () =>
      scopedDeliverables
        .filter((item) => item.status === "Needs Changes" || item.status === "In Review")
        .sort((a, b) => Number(a.status !== "Needs Changes") - Number(b.status !== "Needs Changes"))
        .map((item) => ({
          item,
          body:
            item.status === "Needs Changes"
              ? "Agency needs to create or revise a version."
              : "Waiting for client review.",
        })),
    [scopedDeliverables],
  );

  function clearFilters() {
    setQuery("");
    setStatus("All");
  }

  function selectSummary(id: SummaryId) {
    setStatus(status === id ? "All" : id);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Files"
        description="Agency deliverables across projects. Open one to manage versions and client review."
      />

      <section aria-label="Deliverable status counts">
        <AdminStatGrid columns={4}>
          <AdminStatCard
            label="Deliverables"
            value={activeCount}
            active={status === "All"}
            onClick={() => setStatus("All")}
          />
          <AdminStatCard
            label="In Review"
            value={inReviewCount}
            active={status === "In Review"}
            onClick={() => selectSummary("In Review")}
          />
          <AdminStatCard
            label="Needs Changes"
            value={needsChangesCount}
            active={status === "Needs Changes"}
            onClick={() => selectSummary("Needs Changes")}
          />
          <AdminStatCard
            label="Approved"
            value={approvedCount}
            active={status === "Approved"}
            onClick={() => selectSummary("Approved")}
          />
        </AdminStatGrid>
      </section>

      <AdminAttentionList
        items={attention.map(({ item, body }) => ({
          id: item.id,
          name: item.name,
          body,
          href: hrefFor(item),
          label: "Open",
        }))}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search files</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search deliverable, client, or project"
              className={adminFilterControlState(Boolean(query.trim()))}
            />
          </label>
          {searching ? (
            <button type="button" className={`${adminGhostBtn} shrink-0 justify-center`} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        <AdminStatusChips items={statusFilters} value={status} onChange={setStatus} label="Deliverable status" />
      </div>

      {scopedDeliverables.length === 0 ? (
        <AdminEmptyState
          title="No deliverables yet"
          body="Add designs, content, assets, and documents from a project's Files workspace. Each deliverable can have versions and client review."
          action={
            <Link to={projectsHref} className={`${adminBlueBtn} justify-center`}>
              View Projects
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No deliverables match your filters."
          body="Try a different name, client, project, or status."
          action={
            searching ? (
              <button type="button" className={`${adminGhostBtn} justify-center`} onClick={clearFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <DeliverableList
          items={visible}
          projectName={names.projectName}
          clientName={names.clientName}
          hrefFor={hrefFor}
        />
      )}
    </div>
  );
}

function fileHref(item: AgencyDeliverable, projectBasePath = "/admin/projects") {
  return `${projectBasePath}/${item.projectId}?tab=files&file=${item.id}`;
}

function DeliverableList({
  items,
  projectName,
  clientName,
  hrefFor,
}: {
  items: AgencyDeliverable[];
  projectName: (projectId: string) => string;
  clientName: (projectId: string) => string;
  hrefFor: (item: AgencyDeliverable) => string;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[64rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Deliverable</th>
              <th className="px-5 py-3 font-semibold">Category</th>
              <th className="px-5 py-3 font-semibold">Client</th>
              <th className="px-5 py-3 font-semibold">Project</th>
              <th className="px-5 py-3 font-semibold">Version</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Updated</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const current = currentVersion(item);
              const earlier = earlierVersionCount(item);
              return (
                <tr key={item.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                        <FileTypeIcon fileType={current?.fileType ?? "Other"} />
                      </span>
                      <Link
                        to={hrefFor(item)}
                        className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                      >
                        {item.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{item.category}</td>
                  <td className="px-5 py-3.5">{clientName(item.projectId) || "Unknown client"}</td>
                  <td className="px-5 py-3.5">{projectName(item.projectId) || "Unknown project"}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-[var(--admin-ink)]">{deliverableCurrentVersionLabel(item)}</p>
                    {earlier > 0 ? (
                      <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                        {earlier} earlier {earlier === 1 ? "version" : "versions"}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5">
                    <DeliverableStatusBadge status={item.status} />
                    {item.status === "Needs Changes" || item.status === "In Review" ? (
                      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                        {item.status === "Needs Changes" ? "Revise version" : "Waiting on client"}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatFileUpdatedLabel(deliverableUpdatedAt(item))}</td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={hrefFor(item)}
                      className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((item) => {
          const current = currentVersion(item);
          const earlier = earlierVersionCount(item);
          return (
            <li
              key={item.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                    <FileTypeIcon fileType={current?.fileType ?? "Other"} />
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={hrefFor(item)}
                      className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{item.category}</p>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                      {clientName(item.projectId) || "Unknown client"}
                    </p>
                    <p className="text-[12px] text-[var(--admin-muted)]">
                      {projectName(item.projectId) || "Unknown project"}
                    </p>
                  </div>
                </div>
                <DeliverableStatusBadge status={item.status} />
              </div>
              <p className="mt-3 text-[12px] text-[var(--admin-ink)]">{deliverableCurrentVersionLabel(item)}</p>
              {earlier > 0 ? (
                <p className="text-[12px] text-[var(--admin-muted)]">
                  {earlier} earlier {earlier === 1 ? "version" : "versions"}
                </p>
              ) : null}
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{formatFileUpdatedLabel(deliverableUpdatedAt(item))}</p>
              <Link
                to={hrefFor(item)}
                className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
              >
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
