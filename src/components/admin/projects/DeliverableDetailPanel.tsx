import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { DeliverableStatusBadge } from "@/components/admin/projects/DeliverableStatusBadge";
import { FileTypeIcon } from "@/components/admin/projects/FileTypeIcon";
import { useLeads, useProjectReview } from "@/components/admin/leads/LeadsProvider";
import {
  currentVersion,
  formatFileLong,
  formatFileRelative,
  formatFileSize,
  sortedVersions,
  versionHistoryLabel,
  versionLabel,
  type AgencyDeliverable,
  type AgencyFileVersion,
} from "@/data/files";
import {
  canSendForReview,
  formatReviewLong,
  versionReviewCaption,
} from "@/data/review";
import { hasStoredFile } from "@/data/fileUploadConfig";
import { cn } from "@/lib/cn";

type DeliverableDetailPanelProps = {
  deliverable: AgencyDeliverable;
  onBack: () => void;
  onAddVersion: () => void;
  onPreview: (version: AgencyFileVersion) => void;
  onMakeCurrent: (versionId: string) => void;
  onArchiveVersion: (versionId: string) => void;
  onArchiveDeliverable: () => void;
  onRestore: () => void;
  onSendForReview: () => void;
  onDownload: (version: AgencyFileVersion) => void;
};

export function DeliverableDetailPanel({
  deliverable,
  onBack,
  onAddVersion,
  onPreview,
  onMakeCurrent,
  onArchiveVersion,
  onArchiveDeliverable,
  onRestore,
  onSendForReview,
  onDownload,
}: DeliverableDetailPanelProps) {
  const { profile } = useAuth();
  const canManageFiles = hasPermission(profile, "files.manage");
  const canResolveFeedback = hasPermission(profile, "feedback.manage");
  const { resolveFeedback } = useLeads();
  const review = useProjectReview(deliverable.projectId);
  const current = currentVersion(deliverable);
  const history = sortedVersions(deliverable.versions);
  const [openId, setOpenId] = useState(deliverable.currentVersionId);
  const itemFeedback = review.feedback.filter((item) => item.deliverableId === deliverable.id);
  const itemApprovals = review.approvals.filter((item) => item.deliverableId === deliverable.id);
  const openFeedback = itemFeedback.filter((item) => item.status === "Open");

  return (
    <section className="space-y-4">
      <button
        type="button"
        className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
        onClick={onBack}
      >
        Back to files
      </button>

      <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">{deliverable.name}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">
              {deliverable.description || "No description yet."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <DeliverableStatusBadge status={deliverable.status} />
              <span className="text-[12px] text-[var(--admin-muted)]">{deliverable.category}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {deliverable.status === "Archived" ? (
              canManageFiles ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                  onClick={onRestore}
                >
                  Restore
                </button>
              ) : null
            ) : (
              <>
                {canManageFiles ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white"
                    onClick={onAddVersion}
                  >
                    Add Version
                  </button>
                ) : null}
                {canManageFiles && canSendForReview(deliverable) ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                    onClick={onSendForReview}
                  >
                    Send for Review
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                  disabled={!current}
                  onClick={() => current && onPreview(current)}
                >
                  Preview Current
                </button>
                {canManageFiles ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                    onClick={onArchiveDeliverable}
                  >
                    Archive
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Current version</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
              {current ? versionLabel(current.versionNumber) : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Created</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{formatFileLong(deliverable.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--admin-muted)]">Last updated</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{formatFileLong(deliverable.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Current version</h3>
        {current ? (
          <VersionSummary
            version={current}
            canDownload={hasStoredFile(current)}
            onPreview={() => onPreview(current)}
            onDownload={() => onDownload(current)}
          />
        ) : (
          <div className="mt-3">
            <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No versions yet</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Add a version when work is ready to upload.</p>
          </div>
        )}
      </div>

      <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Version history</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No versions yet</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--admin-line)]">
            {history.map((version) => {
              const label = versionHistoryLabel(version, deliverable.currentVersionId);
              const open = openId === version.id;
              return (
                <li key={version.id} className="py-3">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : version.id)}
                  >
                    <span>
                      <span className="text-sm font-medium text-[var(--admin-ink)]">
                        {versionLabel(version.versionNumber)}
                      </span>
                      <span
                        className={cn(
                          "ml-2 font-heading text-[11px] font-semibold",
                          label === "Current" ? "text-[var(--admin-blue)]" : "text-[var(--admin-muted)]",
                        )}
                      >
                        {label}
                        {versionReviewCaption(version, deliverable, itemFeedback, itemApprovals) !== label ? (
                          <span className="ml-2 text-[var(--admin-muted)]">
                            {versionReviewCaption(version, deliverable, itemFeedback, itemApprovals)}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-[12px] text-[var(--admin-muted)]">
                        {formatFileRelative(version.uploadedAt)} · {version.fileName}
                      </span>
                    </span>
                  </button>
                  {open ? (
                    <div className="mt-3 rounded-lg bg-[var(--admin-bg)] px-3 py-3">
                      <p className="text-[12px] text-[var(--admin-muted)]">
                        {version.fileType} · {formatFileSize(version.fileSize)} · {version.uploadedBy}
                      </p>
                      {version.description ? (
                        <p className="mt-2 text-sm text-[var(--admin-ink)]">{version.description}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] bg-white px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]"
                          onClick={() => onPreview(version)}
                        >
                          Preview
                        </button>
                        {label !== "Current" && canManageFiles ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] bg-white px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]"
                            onClick={() => onMakeCurrent(version.id)}
                          >
                            Make Current
                          </button>
                        ) : null}
                        {canManageFiles && label !== "Current" && version.status !== "Archived" ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] bg-white px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]"
                            onClick={() => onArchiveVersion(version.id)}
                          >
                            Archive Version
                          </button>
                        ) : null}
                        {hasStoredFile(version) ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] bg-white px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]"
                            onClick={() => onDownload(version)}
                          >
                            Download
                          </button>
                        ) : (
                          <span className="inline-flex h-8 items-center px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-muted)]">
                            No file uploaded yet
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {deliverable.description ? (
        <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Description</h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--admin-ink)]">{deliverable.description}</p>
        </div>
      ) : null}

      <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Open feedback</h3>
        {openFeedback.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No open feedback on this deliverable.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {openFeedback.map((item) => {
              const version = deliverable.versions.find((entry) => entry.id === item.versionId);
              return (
                <li key={item.id} className="rounded-lg bg-[var(--admin-bg)] px-3 py-3">
                  <p className="text-[12px] text-[var(--admin-muted)]">
                    {version ? versionLabel(version.versionNumber) : "Version"} · {formatReviewLong(item.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-ink)]">“{item.message}”</p>
                  {canResolveFeedback ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] bg-white px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-hover)]"
                      onClick={() => resolveFeedback(item.id)}
                    >
                      Mark Resolved
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Feedback history</h3>
        {itemFeedback.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No feedback yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {itemFeedback.map((item) => {
              const version = deliverable.versions.find((entry) => entry.id === item.versionId);
              return (
                <li key={item.id}>
                  <p className="text-sm font-medium text-[var(--admin-ink)]">
                    {version ? versionLabel(version.versionNumber) : "Version"} · {item.status}
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-ink)]">“{item.message}”</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatReviewLong(item.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Approval history</h3>
        {itemApprovals.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">No approvals yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {itemApprovals.map((item) => {
              const version = deliverable.versions.find((entry) => entry.id === item.versionId);
              return (
                <li key={item.id}>
                  <p className="text-sm font-medium text-[var(--admin-ink)]">
                    {version ? versionLabel(version.versionNumber) : "Version"} · Approved
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {formatReviewLong(item.approvedAt)} · Approved by {item.approvedBy}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function VersionSummary({
  version,
  canDownload,
  onPreview,
  onDownload,
}: {
  version: AgencyFileVersion;
  canDownload: boolean;
  onPreview: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)]">
        <FileTypeIcon fileType={version.fileType} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{versionLabel(version.versionNumber)}</p>
        <p className="mt-1 truncate text-sm text-[var(--admin-ink)]">{version.fileName}</p>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          {formatFileSize(version.fileSize)} · {version.fileType} · Uploaded by {version.uploadedBy}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            onClick={onPreview}
          >
            Preview
          </button>
          {canDownload ? (
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              onClick={onDownload}
            >
              Download
            </button>
          ) : (
            <span className="inline-flex h-8 items-center font-heading text-[12px] font-semibold text-[var(--admin-muted)]">
              No file uploaded yet
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
