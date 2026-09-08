import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, FolderKanban, MessageSquareQuote, RefreshCw, SquareCheck, Upload } from "lucide-react";
import { adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  formatProjectDate,
  formatProjectTimestamp,
  type AgencyProjectActivity,
} from "@/data/agencyProjects";

const icons = {
  created: FolderKanban,
  status: RefreshCw,
  task: SquareCheck,
  milestone: Flag,
  file: Upload,
  progress: RefreshCw,
  review: MessageSquareQuote,
} as const;

type ActivityKind = AgencyProjectActivity["icon"];

const kindFilters = ["All", "created", "status", "task", "milestone", "file", "progress", "review"] as const;
type KindFilter = (typeof kindFilters)[number];

const kindLabels: Record<ActivityKind, string> = {
  created: "Created",
  status: "Status",
  task: "Task",
  milestone: "Milestone",
  file: "File",
  progress: "Progress",
  review: "Review",
};

type FeedItem = AgencyProjectActivity & {
  projectId: string;
  projectName: string;
  clientName: string;
};

const PAGE_SIZE = 30;

export function AdminActivity() {
  const { projects, clients } = useLeads();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("All");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const clientsById = useMemo(
    () => new Map(clients.map((client) => [client.id, { businessName: client.businessName }])),
    [clients],
  );

  const feed = useMemo<FeedItem[]>(() => {
    const items = projects.flatMap((project) =>
      project.activity.map((item) => ({
        ...item,
        projectId: project.id,
        projectName: project.name,
        clientName: clientsById.get(project.clientId)?.businessName ?? "",
      })),
    );
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [projects, clientsById]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return feed.filter((item) => {
      if (kind !== "All" && item.icon !== kind) return false;
      if (!needle) return true;
      return (
        item.description.toLowerCase().includes(needle) ||
        item.projectName.toLowerCase().includes(needle) ||
        item.clientName.toLowerCase().includes(needle)
      );
    });
  }, [feed, query, kind]);

  const visible = filtered.slice(0, visibleCount);
  const filtering = query.trim().length > 0 || kind !== "All";

  function clearFilters() {
    setQuery("");
    setKind("All");
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Activity"
        description="Everything happening across every project and client, newest first."
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search activity</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Search by project, client, or description"
              className={adminFilterControlState(Boolean(query.trim()))}
            />
          </label>
          <label className="lg:w-48">
            <span className="sr-only">Activity type</span>
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as KindFilter);
                setVisibleCount(PAGE_SIZE);
              }}
              className={adminFilterControlState(kind !== "All")}
            >
              {kindFilters.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All" : kindLabels[item]}
                </option>
              ))}
            </select>
          </label>
          {filtering ? (
            <button type="button" className={`${adminGhostBtn} shrink-0 justify-center`} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {feed.length === 0 ? (
        <AdminEmptyState
          title="No activity yet"
          body="Activity from every project — status changes, tasks, milestones, files, and reviews — will appear here as work happens."
        />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="No activity matches your filters."
          body="Try a different search term or activity type."
          action={
            filtering ? (
              <button type="button" className={`${adminGhostBtn} justify-center`} onClick={clearFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <ol className="space-y-0">
            {visible.map((item, index) => {
              const Icon = icons[item.icon];
              return (
                <li key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-[var(--admin-hover)] text-[var(--admin-blue)]">
                      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    {index < visible.length - 1 ? (
                      <span className="w-px flex-1 bg-[var(--admin-line)]" aria-hidden="true" />
                    ) : null}
                  </div>
                  <div className="pb-5">
                    <p className="text-sm text-[var(--admin-ink)]">
                      <Link to={`/admin/projects/${item.projectId}`} className="font-medium hover:underline">
                        {item.projectName}
                      </Link>
                      {item.clientName ? (
                        <span className="text-[var(--admin-muted)]"> · {item.clientName}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--admin-ink)]">{item.description}</p>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                      {formatProjectDate(item.createdAt)} · {formatProjectTimestamp(item.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {visibleCount < filtered.length ? (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                className={`${adminGhostBtn} justify-center`}
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Show more
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
