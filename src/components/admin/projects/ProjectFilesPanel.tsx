import { useMemo, useState } from "react";
import { Archive as ArchiveIcon, Eye, PencilLine, Send, Upload } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { AdminActionsMenu } from "@/components/admin/AdminActionsMenu";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/admin/Breadcrumbs";
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
  deliverableUpdatedAt,
  fileSortOptions,
  filterDeliverables,
  formatFileHistoryDate,
  sortDeliverables,
  versionLabel,
  type AgencyDeliverable,
  type AgencyFileVersion,
  type DeliverableCategory,
  type DeliverableDraft,
  type DeliverableStatus,
  type FileSort,
} from "@/data/files";
import { canSendForReview } from "@/data/review";
import type { AgencyProject } from "@/data/agencyProjects";

const statusFilters = ["All", ...deliverableStatuses] as const;

type ProjectFilesPanelProps = {
  project: AgencyProject;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Breadcrumb trail up to and including "Files" (e.g. "My Projects / Website Redesign / Files").
   *  The selected deliverable's name is appended automatically. Omit to fall back to a plain
   *  "Back to files" link. */
  breadcrumbItems?: BreadcrumbItem[];
};

export function ProjectFilesPanel({ project, selectedId, onSelect, breadcrumbItems }: ProjectFilesPanelProps) {
  const { profile } = useAuth();
  const canManageFiles = hasPermission(profile, "files.manage");
  const {
    addDeliverable,
    updateDeliverable,
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
  const [editingDeliverable, setEditingDeliverable] = useState<AgencyDeliverable | null>(null);
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
          breadcrumb={
            breadcrumbItems ? (
              <Breadcrumbs items={[...breadcrumbItems, { label: selected.name }]} />
            ) : undefined
          }
          onAddVersion={() => setVersionTarget(selected)}
          onPreview={openPreview}
          onMakeCurrent={(versionId) => setCurrentVersion(selected.id, versionId)}
          onArchiveVersion={(versionId) => archiveVersion(selected.id, versionId)}
          onEdit={() => setEditingDeliverable(selected)}
          onArchiveDeliverable={() => setArchiveTarget(selected)}
          onRestore={() => restoreDeliverable(selected.id)}
          onSendForReview={() => setSendTarget(selected)}
          onDownload={(version) => {
            void downloadFile(version);
          }}
        />
        <FileModals
          createOpen={createOpen}
          editingDeliverable={editingDeliverable}
          onCreateClose={() => {
            setCreateOpen(false);
            setEditingDeliverable(null);
          }}
          onCreate={(draft, file) => addDeliverable(project.id, draft, file)}
          onUpdate={async (draft) => {
            if (!editingDeliverable) return false;
            return updateDeliverable(editingDeliverable.id, draft);
          }}
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
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Deliverables</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            Designs, content, assets, and documents for this website. Each item can have versions and client review.
          </p>
        </div>
        {canManageFiles ? (
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white"
            onClick={() => setCreateOpen(true)}
          >
            + New Deliverable
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search files</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search deliverables..."
              className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          <label className="lg:w-44">
            <span className="sr-only">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as DeliverableStatus | "All")}
              className="h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            >
              {statusFilters.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All statuses" : item}
                </option>
              ))}
            </select>
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
      </div>

      <DeliverableList
        items={visible}
        allItems={items}
        total={items.length}
        query={query}
        status={status}
        canManageFiles={canManageFiles}
        onView={onSelect}
        onUploadVersion={canManageFiles ? setVersionTarget : undefined}
        onSendForReview={canManageFiles ? setSendTarget : undefined}
        onEdit={canManageFiles ? setEditingDeliverable : undefined}
        onArchive={canManageFiles ? setArchiveTarget : undefined}
      />

      <FileModals
        createOpen={createOpen}
        editingDeliverable={editingDeliverable}
        onCreateClose={() => {
          setCreateOpen(false);
          setEditingDeliverable(null);
        }}
        onCreate={(draft, file) => addDeliverable(project.id, draft, file)}
        onUpdate={async (draft) => {
          if (!editingDeliverable) return false;
          return updateDeliverable(editingDeliverable.id, draft);
        }}
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
  allItems,
  total,
  query,
  status,
  canManageFiles,
  onView,
  onUploadVersion,
  onSendForReview,
  onEdit,
  onArchive,
}: {
  items: AgencyDeliverable[];
  allItems: AgencyDeliverable[];
  total: number;
  query: string;
  status: DeliverableStatus | "All";
  canManageFiles: boolean;
  onView: (id: string) => void;
  onUploadVersion?: (item: AgencyDeliverable) => void;
  onSendForReview?: (item: AgencyDeliverable) => void;
  onEdit?: (item: AgencyDeliverable) => void;
  onArchive?: (item: AgencyDeliverable) => void;
}) {
  if (total === 0) {
    return (
      <div className="mt-6">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No deliverables yet</p>
        <p className="mt-1 max-w-xl text-sm text-[var(--admin-muted)]">
          Add designs, content, assets, documents, and other project deliverables here. Each deliverable can have
          multiple versions and move through client review.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    const message =
      query.trim() !== ""
        ? "No deliverables match your search."
        : status === "All"
          ? "No active deliverables."
          : "No deliverables match these filters.";
    return <p className="mt-6 text-sm text-[var(--admin-muted)]">{message}</p>;
  }

  const approved =
    status === "All" && !query.trim()
      ? allItems.filter((item) => item.status === "Approved")
      : [];

  return (
    <div className="mt-5 space-y-5">
      {approved.length > 0 ? (
        <div className="rounded-xl bg-[var(--admin-bg)] px-4 py-3">
          <p className="font-heading text-[12px] font-semibold text-[var(--admin-ink)]">Approved for implementation</p>
          <ul className="mt-2 space-y-1.5">
            {approved.map((item) => {
              const current = currentVersion(item);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <button
                    type="button"
                    className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)] hover:underline"
                    onClick={() => onView(item.id)}
                  >
                    {item.name}
                  </button>
                  <span className="text-[var(--admin-muted)]">{item.category}</span>
                  <span className="font-heading text-[12px] font-semibold text-[var(--admin-ink)]">
                    {current ? versionLabel(current.versionNumber) : "No version"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)]">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-[var(--admin-line)] bg-[var(--admin-bg)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
            <tr>
              <th className="px-4 py-3 font-heading">Deliverable</th>
              <th className="px-4 py-3 font-heading">Status</th>
              <th className="px-4 py-3 font-heading">Category</th>
              <th className="px-4 py-3 font-heading">Version</th>
              <th className="px-4 py-3 font-heading">Updated</th>
              <th className="px-4 py-3 font-heading">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-line)]">
            {items.map((item) => {
              const current = currentVersion(item);
              const sendable = Boolean(onSendForReview && canSendForReview(item));
              const archived = item.status === "Archived";
              return (
                <tr key={item.id} className="hover:bg-[var(--admin-bg)]">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                        <FileTypeIcon fileType={current?.fileType ?? "Other"} />
                      </span>
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="text-left font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                          onClick={() => onView(item.id)}
                        >
                          {item.name}
                        </button>
                        {item.description ? (
                          <p className="mt-0.5 max-w-xs text-[12px] text-[var(--admin-muted)]">{item.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <DeliverableStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 align-middle text-[var(--admin-muted)]">{item.category}</td>
                  <td className="px-4 py-3 align-middle text-[var(--admin-ink)]">
                    {current ? versionLabel(current.versionNumber) : "No version"}
                  </td>
                  <td className="px-4 py-3 align-middle text-[var(--admin-muted)]">
                    {formatFileHistoryDate(deliverableUpdatedAt(item))}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <AdminActionsMenu
                      ariaLabel={`Actions for ${item.name}`}
                      iconOnly
                      items={[
                        { id: "view", label: "View", icon: Eye, onSelect: () => onView(item.id) },
                        ...(canManageFiles && !archived && onUploadVersion
                          ? [{ id: "upload", label: "Upload Version", icon: Upload, onSelect: () => onUploadVersion(item) }]
                          : []),
                        ...(sendable
                          ? [{ id: "send", label: "Send for Review", icon: Send, onSelect: () => onSendForReview?.(item) }]
                          : []),
                        ...(canManageFiles && !archived && onEdit
                          ? [{ id: "edit", label: "Edit", icon: PencilLine, onSelect: () => onEdit(item) }]
                          : []),
                        ...(canManageFiles && !archived && onArchive
                          ? [
                              {
                                id: "archive",
                                label: "Archive",
                                icon: ArchiveIcon,
                                danger: true,
                                separatorBefore: true,
                                onSelect: () => onArchive(item),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FileModals({
  createOpen,
  editingDeliverable,
  onCreateClose,
  onCreate,
  onUpdate,
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
  editingDeliverable: AgencyDeliverable | null;
  onCreateClose: () => void;
  onCreate: (draft: DeliverableDraft, file: File | null) => Promise<boolean>;
  onUpdate: (draft: DeliverableDraft) => Promise<boolean>;
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
      <DeliverableFormModal
        open={createOpen || Boolean(editingDeliverable)}
        deliverable={editingDeliverable}
        onClose={onCreateClose}
        onSubmit={(draft, file) => (editingDeliverable ? onUpdate(draft) : onCreate(draft, file))}
      />
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
