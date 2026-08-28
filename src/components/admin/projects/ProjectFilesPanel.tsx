import { useMemo, useState } from "react";
import { ConfirmArchiveDeliverableModal } from "@/components/admin/projects/ConfirmArchiveDeliverableModal";
import { ConfirmSendForReviewModal } from "@/components/admin/projects/ConfirmSendForReviewModal";
import { DeliverableDetailPanel } from "@/components/admin/projects/DeliverableDetailPanel";
import { DeliverableFormModal } from "@/components/admin/projects/DeliverableFormModal";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { FileTypeIcon } from "@/components/admin/projects/FileTypeIcon";
import { VersionFormModal } from "@/components/admin/projects/VersionFormModal";
import { VersionPreviewModal } from "@/components/admin/projects/VersionPreviewModal";
import { useLeads, useProjectDeliverables } from "@/components/admin/leads/LeadsProvider";
import {
  currentVersion,
  deliverableCategories,
  deliverableStatuses,
  fileSortOptions,
  filterDeliverables,
  formatFileUpdated,
  sortDeliverables,
  versionLabel,
  type AgencyDeliverable,
  type AgencyFileVersion,
  type DeliverableCategory,
  type DeliverableStatus,
  type FileSort,
} from "@/data/files";
import type { AgencyProject } from "@/data/agencyProjects";
import { cn } from "@/lib/cn";

const statusFilters = ["All", ...deliverableStatuses] as const;

type ProjectFilesPanelProps = {
  project: AgencyProject;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function ProjectFilesPanel({ project, selectedId, onSelect }: ProjectFilesPanelProps) {
  const {
    addDeliverable,
    addVersion,
    setCurrentVersion,
    archiveVersion,
    archiveDeliverable,
    restoreDeliverable,
    sendForReview,
    downloadFile,
  } = useLeads();
  const items = useProjectDeliverables(project.id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DeliverableStatus | "All">("All");
  const [category, setCategory] = useState<DeliverableCategory | "All">("All");
  const [sort, setSort] = useState<FileSort>("updated");
  const [createOpen, setCreateOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<AgencyDeliverable | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AgencyDeliverable | null>(null);
  const [preview, setPreview] = useState<AgencyFileVersion | null>(null);
  const [sendTarget, setSendTarget] = useState<AgencyDeliverable | null>(null);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const visible = useMemo(
    () => sortDeliverables(filterDeliverables(items, query, status, category), sort),
    [category, items, query, sort, status],
  );

  function openPreview(version: AgencyFileVersion) {
    setPreview(version);
  }

  if (selected) {
    return (
      <>
        <DeliverableDetailPanel
          key={selected.id}
          deliverable={selected}
          onBack={() => onSelect(null)}
          onAddVersion={() => setVersionTarget(selected)}
          onPreview={openPreview}
          onMakeCurrent={(versionId) => setCurrentVersion(selected.id, versionId)}
          onArchiveVersion={(versionId) => archiveVersion(selected.id, versionId)}
          onArchiveDeliverable={() => setArchiveTarget(selected)}
          onRestore={() => restoreDeliverable(selected.id)}
          onSendForReview={() => setSendTarget(selected)}
          onDownload={(version) => {
            void downloadFile(version);
          }}
        />
        <FileModals
          createOpen={createOpen}
          onCreateClose={() => setCreateOpen(false)}
          onCreate={(draft, file) => addDeliverable(project.id, draft, file)}
          versionTarget={versionTarget}
          onVersionClose={() => setVersionTarget(null)}
          onVersion={async (file, description) => {
            if (!versionTarget) return false;
            return addVersion(versionTarget.id, file, description);
          }}
          archiveTarget={archiveTarget}
          onArchiveClose={() => setArchiveTarget(null)}
          onArchiveConfirm={() => {
            if (archiveTarget) archiveDeliverable(archiveTarget.id);
            setArchiveTarget(null);
          }}
          preview={preview}
          previewCurrentId={selected.currentVersionId}
          onPreviewClose={() => setPreview(null)}
          onDownload={() => {
            if (preview) void downloadFile(preview);
          }}
          sendTarget={sendTarget}
          onSendClose={() => setSendTarget(null)}
          onSendConfirm={() => {
            if (sendTarget) sendForReview(sendTarget.id);
            setSendTarget(null);
          }}
        />
      </>
    );
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Files</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Project deliverables and their versions.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white"
          onClick={() => setCreateOpen(true)}
        >
          + New Deliverable
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search files</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files..."
              className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          <label className="lg:w-44">
            <span className="sr-only">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as DeliverableCategory | "All")}
              className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            >
              <option value="All">All categories</option>
              {deliverableCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="lg:w-48">
            <span className="sr-only">Sort files</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as FileSort)}
              className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            >
              {fileSortOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
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

      <DeliverableList
        items={visible}
        total={items.length}
        query={query}
        status={status}
        onView={onSelect}
      />

      <FileModals
        createOpen={createOpen}
        onCreateClose={() => setCreateOpen(false)}
        onCreate={(draft, file) => addDeliverable(project.id, draft, file)}
        versionTarget={versionTarget}
        onVersionClose={() => setVersionTarget(null)}
        onVersion={async (file, description) => {
          if (!versionTarget) return false;
          return addVersion(versionTarget.id, file, description);
        }}
        archiveTarget={archiveTarget}
        onArchiveClose={() => setArchiveTarget(null)}
        onArchiveConfirm={() => {
          if (archiveTarget) archiveDeliverable(archiveTarget.id);
          setArchiveTarget(null);
        }}
        preview={preview}
        previewCurrentId={null}
        onPreviewClose={() => setPreview(null)}
        onDownload={() => {
          if (preview) void downloadFile(preview);
        }}
        sendTarget={sendTarget}
        onSendClose={() => setSendTarget(null)}
        onSendConfirm={() => {
          if (sendTarget) sendForReview(sendTarget.id);
          setSendTarget(null);
        }}
      />
    </section>
  );
}

function DeliverableList({
  items,
  total,
  query,
  status,
  onView,
}: {
  items: AgencyDeliverable[];
  total: number;
  query: string;
  status: DeliverableStatus | "All";
  onView: (id: string) => void;
}) {
  if (total === 0) {
    return (
      <div className="mt-6">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No deliverables yet</p>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Add a deliverable to start organizing project work.</p>
      </div>
    );
  }

  if (items.length === 0) {
    const message =
      query.trim() !== ""
        ? "No files match your search."
        : status === "All"
          ? "No active deliverables."
          : "No files match your search.";
    return <p className="mt-6 text-sm text-[var(--admin-muted)]">{message}</p>;
  }

  return (
    <ul className="mt-5 divide-y divide-[var(--admin-line)]">
      {items.map((item) => {
        const current = currentVersion(item);
        const count = item.versions.length;
        return (
          <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                <FileTypeIcon fileType={current?.fileType ?? "Other"} />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{item.name}</p>
                <p className="mt-0.5 text-[13px] text-[var(--admin-muted)]">
                  {item.description || "No description yet."}
                </p>
                <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                  {current ? `${versionLabel(current.versionNumber)} · ` : "No versions · "}
                  {count} {count === 1 ? "version" : "versions"}
                  <span aria-hidden="true"> · </span>
                  Updated {formatFileUpdated(item.updatedAt)}
                </p>
                <div className="mt-2">
                  <DeliverableStatusBadge status={item.status} />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center self-start rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] sm:self-center"
              onClick={() => onView(item.id)}
            >
              View
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FileModals({
  createOpen,
  onCreateClose,
  onCreate,
  versionTarget,
  onVersionClose,
  onVersion,
  archiveTarget,
  onArchiveClose,
  onArchiveConfirm,
  preview,
  previewCurrentId,
  onPreviewClose,
  onDownload,
  sendTarget,
  onSendClose,
  onSendConfirm,
}: {
  createOpen: boolean;
  onCreateClose: () => void;
  onCreate: Parameters<typeof DeliverableFormModal>[0]["onSubmit"];
  versionTarget: AgencyDeliverable | null;
  onVersionClose: () => void;
  onVersion: (file: File, description: string) => Promise<boolean>;
  archiveTarget: AgencyDeliverable | null;
  onArchiveClose: () => void;
  onArchiveConfirm: () => void;
  preview: AgencyFileVersion | null;
  previewCurrentId: string | null;
  onPreviewClose: () => void;
  onDownload: () => void;
  sendTarget: AgencyDeliverable | null;
  onSendClose: () => void;
  onSendConfirm: () => void;
}) {
  return (
    <>
      <DeliverableFormModal open={createOpen} onClose={onCreateClose} onSubmit={onCreate} />
      <VersionFormModal deliverable={versionTarget} onClose={onVersionClose} onSubmit={onVersion} />
      <ConfirmArchiveDeliverableModal
        deliverable={archiveTarget}
        onClose={onArchiveClose}
        onConfirm={onArchiveConfirm}
      />
      <ConfirmSendForReviewModal deliverable={sendTarget} onClose={onSendClose} onConfirm={onSendConfirm} />
      <VersionPreviewModal
        version={preview}
        isCurrent={Boolean(preview && preview.id === previewCurrentId)}
        onClose={onPreviewClose}
        onDownload={onDownload}
      />
    </>
  );
}
