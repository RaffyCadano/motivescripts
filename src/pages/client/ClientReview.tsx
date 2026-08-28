import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { ClientConfirmDialog } from "@/components/client/ClientConfirmDialog";
import { ClientRequestChangesDialog } from "@/components/client/ClientRequestChangesDialog";
import { ClientStatusBadge } from "@/components/client/ClientStatusBadge";
import { StoredFilePreview } from "@/components/files/StoredFilePreview";
import { useLeads, usePortalSession } from "@/components/admin/leads/LeadsProvider";
import {
  currentVersion,
  formatFileLong,
  formatFileSize,
  sortedVersions,
  versionLabel,
} from "@/data/files";
import {
  canClientReview,
  canLeaveFeedback,
  clientReviewLabel,
  clientStatusTone,
  formatReviewLong,
  versionReviewCaption,
} from "@/data/review";
import { cn } from "@/lib/cn";
import { hasStoredFile } from "@/data/fileUploadConfig";

export function ClientReview() {
  const { deliverableId } = useParams();
  const { files, feedback, approvals } = usePortalSession();
  const { submitFeedback, requestChanges, approveVersion, downloadFile } = useLeads();
  const file = files.find((item) => item.id === deliverableId) ?? null;
  const current = file ? currentVersion(file) : null;
  const history = file ? sortedVersions(file.versions) : [];
  const [note, setNote] = useState("");
  const [changesOpen, setChangesOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  if (!file) {
    return (
      <div className="w-full">
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight">File not found</h1>
        <Link to="/client/files" className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--client-blue)] hover:underline">
          Back to files
        </Link>
      </div>
    );
  }

  const reviewable = canClientReview(file);
  const feedbackable = canLeaveFeedback(file);
  const approved = file.status === "Approved";
  const archived = file.status === "Archived";
  const currentApproval = current ? approvals.find((item) => item.versionId === current.id) : undefined;
  const itemFeedback = feedback.filter((item) => item.deliverableId === file.id);

  function onFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim() || !file) return;
    submitFeedback(file.id, note);
    setNote("");
  }

  return (
    <div className="w-full space-y-6">
      <Link to="/client/files" className="text-[12px] font-medium text-[var(--client-blue)] hover:underline">
        Files
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">{file.name}</h1>
          <p className="mt-1 text-sm text-[var(--client-muted)]">{file.description}</p>
        </div>
        <ClientStatusBadge label={clientReviewLabel(file.status)} tone={clientStatusTone(file.status)} />
      </header>

      {archived ? (
        <p className="text-sm text-[var(--client-muted)]">This deliverable is archived.</p>
      ) : null}

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Current version</p>
        {current ? (
          <>
            <h2 className="mt-2 font-heading text-xl font-semibold text-[var(--client-ink)]">
              {versionLabel(current.versionNumber)}
            </h2>
            <p className="mt-1 text-sm font-medium text-[var(--client-blue)]">CURRENT VERSION</p>
            <p className="mt-3 text-sm text-[var(--client-muted)]">{current.fileName}</p>
            <p className="mt-1 text-[12px] text-[var(--client-muted)]">
              {current.fileType} · {formatFileSize(current.fileSize)} · Uploaded {formatFileLong(current.uploadedAt)}
            </p>
            {current.description ? (
              <p className="mt-3 text-sm text-[var(--client-ink)]">{current.description}</p>
            ) : null}
            {reviewable ? (
              <p className="mt-4 text-sm text-[var(--client-ink)]">This version is ready for your review.</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-11 items-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
                onClick={() => setPreview(true)}
              >
                Preview
              </button>
              {current && hasStoredFile(current) ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
                  onClick={() => void downloadFile(current)}
                >
                  Download
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--client-muted)]">No current version available.</p>
        )}
      </section>

      {reviewable && current ? (
        <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Your Review</h2>
          <p className="mt-2 text-sm text-[var(--client-muted)]">What would you like to do?</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
              onClick={() => setApproveOpen(true)}
            >
              Approve Version
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
              onClick={() => setChangesOpen(true)}
            >
              Request Changes
            </button>
          </div>
        </section>
      ) : null}

      {feedbackable && current ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <form onSubmit={onFeedback}>
            <label htmlFor="client-feedback" className="font-heading text-sm font-semibold text-[var(--client-ink)]">
              Leave Feedback
            </label>
            <textarea
              id="client-feedback"
              required
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What should we change?"
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-3 py-2.5 text-sm text-[var(--client-ink)] outline-none placeholder:text-[var(--client-muted)] focus:border-[rgb(0_80_240_/_0.45)]"
            />
            <button
              type="submit"
              disabled={!note.trim()}
              className="mt-3 inline-flex h-11 items-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-bg)] disabled:opacity-50"
            >
              Submit Feedback
            </button>
          </form>
        </section>
      ) : null}

      {approved && current ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <div className="flex gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgb(16_185_129_/_0.12)] text-[#0f7a56]">
              <Check size={16} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">Approved</p>
              <p className="mt-1 text-sm text-[var(--client-muted)]">
                This version was approved
                {currentApproval ? ` on ${formatReviewLong(currentApproval.approvedAt)}.` : "."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Feedback history</h2>
        {itemFeedback.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--client-muted)]">No feedback yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {itemFeedback.map((item) => {
              const version = file.versions.find((entry) => entry.id === item.versionId);
              return (
                <li key={item.id}>
                  <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">
                    {version ? versionLabel(version.versionNumber) : "Version"} · {item.status}
                  </p>
                  <p className="mt-1 text-sm text-[var(--client-ink)]">“{item.message}”</p>
                  <p className="mt-1 text-[12px] text-[var(--client-muted)]">{formatReviewLong(item.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Previous versions</h2>
        <p className="mt-1 text-[12px] text-[var(--client-muted)]">Historical versions cannot be approved.</p>
        <ul className="mt-4 divide-y divide-[var(--client-line)]">
          {history.map((version) => {
            const isCurrent = version.id === file.currentVersionId;
            return (
              <li key={version.id} className="py-3">
                <p className={cn("text-sm font-medium", isCurrent ? "text-[var(--client-ink)]" : "text-[var(--client-muted)]")}>
                  {versionLabel(version.versionNumber)}
                  <span className="ml-2 font-heading text-[11px] font-semibold">
                    {isCurrent ? "Current" : "Historical"}
                    {" · "}
                    {versionReviewCaption(version, file, feedback, approvals)}
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-[var(--client-muted)]">{version.fileName}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <ClientConfirmDialog
        open={approveOpen}
        title="Approve this version?"
        body={
          current
            ? `You're approving ${file.name} ${versionLabel(current.versionNumber)} as the current version.`
            : "You're approving the current version of this deliverable."
        }
        confirmLabel="Approve Version"
        onCancel={() => setApproveOpen(false)}
        onConfirm={() => {
          if (!file) return;
          approveVersion(file.id);
          setApproveOpen(false);
        }}
      />

      <ClientRequestChangesDialog
        open={changesOpen}
        onCancel={() => setChangesOpen(false)}
        onSubmit={(message) => {
          if (!file) return;
          requestChanges(file.id, message);
          setChangesOpen(false);
        }}
      />

      {preview && current ? (
        <div className="client-theme fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
          <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]" aria-label="Close preview" onClick={() => setPreview(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-preview-title"
            className="relative w-full max-w-2xl rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white p-5 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
          >
            <h2 id="client-preview-title" className="font-heading text-lg font-semibold text-[var(--client-ink)]">
              {current.fileName}
            </h2>
            <p className="mt-1 text-sm text-[var(--client-muted)]">
              {versionLabel(current.versionNumber)} · CURRENT VERSION
            </p>
            <div className="mt-4 overflow-hidden rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-bg)]">
              <StoredFilePreview version={current} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {hasStoredFile(current) ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)]"
                  onClick={() => void downloadFile(current)}
                >
                  Download
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-11 items-center rounded-[var(--radius-md)] bg-[var(--client-navy)] px-5 font-heading text-sm font-semibold text-white"
                onClick={() => setPreview(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
