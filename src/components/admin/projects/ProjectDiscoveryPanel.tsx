import { useEffect, useState, type ReactNode } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { formatClientDate } from "@/data/agencyClients";
import {
  DISCOVERY_FOLLOW_UP_ITEMS,
  DISCOVERY_QUESTIONNAIRE_SECTIONS,
  discoveryChecklistItems,
  discoverySectionSummary,
  discoveryStatusLabel,
  scopeFeaturesForDiscovery,
  scopePagesForDiscovery,
  type DiscoveryIntake,
  type DiscoveryIntakeFile,
  type DiscoverySectionId,
  type DiscoverySectionReviewState,
} from "@/data/discoveryIntake";
import {
  fetchDiscoveryIntakeByProject,
  fetchDiscoveryIntakeFiles,
  markDiscoveryComplete,
  markDiscoveryUnderReview,
  requestDiscoveryFollowUp,
  sendDiscoveryIntake,
  startDiscoveryFollowUpConversation,
  updateDiscoveryInternalNotes,
  updateDiscoverySectionReview,
} from "@/data/discoveryIntakeRepository";
import type { ClientScopeBrief } from "@/data/scopeBriefs";
import { signedUrlForPath } from "@/data/fileStorage";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type ProjectDiscoveryPanelProps = {
  projectId: string;
  clientId: string;
  projectName: string;
  brief: ClientScopeBrief | null;
};

export function ProjectDiscoveryPanel({ projectId, clientId, projectName, brief }: ProjectDiscoveryPanelProps) {
  const [intake, setIntake] = useState<DiscoveryIntake | null>(null);
  const [files, setFiles] = useState<DiscoveryIntakeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [sendPreviewOpen, setSendPreviewOpen] = useState(false);
  const [notes, setNotes] = useState("");

  async function reload() {
    const row = await fetchDiscoveryIntakeByProject(projectId);
    setIntake(row);
    if (row) {
      setNotes(row.internalNotes);
      const intakeFiles = await fetchDiscoveryIntakeFiles(row.id);
      setFiles(intakeFiles);
    } else {
      setFiles([]);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void reload()
      .catch(() => {
        if (active) setError("Unable to load discovery intake.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update discovery.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <p className="text-sm text-[var(--admin-muted)]">Loading discovery…</p>
      </section>
    );
  }

  if (!intake) {
    return (
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Discovery</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Discovery intake is not available for this project yet.</p>
      </section>
    );
  }

  const checklist = discoveryChecklistItems(intake, brief, files);
  const attentionCount = checklist.filter((item) => item.state === "attention").length;

  return (
    <section id="project-discovery" className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Website Discovery</h2>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Collect the information we need from the client before design and development begin.
          </p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            Status: <span className="font-medium text-[var(--admin-ink)]">{discoveryStatusLabel(intake.status)}</span>
            {intake.submittedAt ? ` · Submitted ${formatClientDate(intake.submittedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {intake.status === "not_started" ? (
            <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={() => setSendPreviewOpen(true)}>
              Send Discovery Request to Client
            </button>
          ) : null}
          {intake.submittedAt || intake.status === "submitted" || intake.status === "under_review" ? (
            <button type="button" className={adminGhostBtn} onClick={() => setReviewOpen(true)}>Review Discovery</button>
          ) : null}
          {intake.status === "submitted" || intake.status === "under_review" ? (
            <button type="button" className={adminGhostBtn} onClick={() => setFollowUpOpen(true)}>Request Follow-Up</button>
          ) : null}
          {intake.status !== "complete" && intake.submittedAt ? (
            <button type="button" disabled={busy} className={adminGhostBtn} onClick={() => void run(() => markDiscoveryComplete(projectId).then(() => undefined))}>
              Approve / Complete Discovery
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-[#b45309]">{error}</p> : null}

      <ul className="mt-4 space-y-2">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span>{item.state === "ok" ? "✓" : item.state === "attention" ? "⚠" : "○"}</span>
            <span className={cn(item.state === "attention" && "font-medium text-[var(--admin-ink)]")}>{item.label}</span>
          </li>
        ))}
      </ul>
      {attentionCount > 0 ? (
        <p className="mt-3 text-[12px] text-[var(--admin-muted)]">{attentionCount} item{attentionCount === 1 ? "" : "s"} need attention</p>
      ) : null}

      {intake.scopeFlags.length > 0 ? (
        <div className="mt-5 rounded-lg border border-[rgb(180_83_9_/_0.35)] bg-[rgb(180_83_9_/_0.06)] p-4">
          <p className="font-heading text-[12px] font-semibold uppercase tracking-[0.12em] text-[#b45309]">Potential scope change</p>
          <ul className="mt-2 space-y-2 text-sm">
            {intake.scopeFlags.map((flag) => (
              <li key={flag.id}>
                Client requested: <span className="font-medium">{flag.label}</span>
                <span className="text-[var(--admin-muted)]"> ({flag.kind})</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[var(--admin-muted)]">Review in the change request workflow. Nothing was added to scope automatically.</p>
        </div>
      ) : null}

      <DiscoverySendPreviewDialog
        open={sendPreviewOpen}
        busy={busy}
        onClose={() => setSendPreviewOpen(false)}
        onConfirm={() =>
          void run(async () => {
            await sendDiscoveryIntake(projectId, clientId);
            setSendPreviewOpen(false);
          })
        }
      />

      <DiscoveryReviewDialog
        open={reviewOpen}
        intake={intake}
        brief={brief}
        files={files}
        notes={notes}
        onNotesChange={setNotes}
        onClose={() => setReviewOpen(false)}
        onSaveNotes={() => void run(() => updateDiscoveryInternalNotes(projectId, notes).then(() => undefined))}
        onMarkReview={() => void run(() => markDiscoveryUnderReview(projectId).then(() => undefined))}
        onSectionReview={(section, state) =>
          void run(() =>
            updateDiscoverySectionReview(projectId, { ...intake.sectionReview, [section]: state }).then(() => undefined),
          )
        }
      />

      <DiscoveryRequestMoreDialog
        open={followUpOpen}
        busy={busy}
        onClose={() => setFollowUpOpen(false)}
        onSend={(missingItems, message) =>
          void run(async () => {
            await requestDiscoveryFollowUp(projectId, { missingItems, message });
            await startDiscoveryFollowUpConversation({
              projectId,
              clientId,
              projectName,
              message,
            });
            setFollowUpOpen(false);
          })
        }
      />
    </section>
  );
}

function DiscoverySendPreviewDialog({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AdminDialog
      open={open}
      title="Send discovery request"
      description="The client will receive a notification and can complete this questionnaire in their portal."
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-4 text-sm">
        <p className="text-[var(--admin-muted)]">Review the sections included in this discovery request:</p>
        <ul className="space-y-3">
          {DISCOVERY_QUESTIONNAIRE_SECTIONS.map((section) => (
            <li key={section.id} className="rounded-lg border border-[var(--admin-line)] px-3 py-2">
              <p className="font-heading text-[12px] font-semibold text-[var(--admin-ink)]">{section.label}</p>
              <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{section.detail}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={adminGhostBtn} onClick={onClose}>Cancel</button>
          <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={onConfirm}>
            {busy ? "Sending…" : "Send Discovery Request to Client"}
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}

function DiscoveryReviewDialog({
  open,
  intake,
  brief,
  files,
  notes,
  onNotesChange,
  onClose,
  onSaveNotes,
  onMarkReview,
  onSectionReview,
}: {
  open: boolean;
  intake: DiscoveryIntake;
  brief: ClientScopeBrief | null;
  files: DiscoveryIntakeFile[];
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSaveNotes: () => void;
  onMarkReview: () => void;
  onSectionReview: (section: DiscoverySectionId, state: DiscoverySectionReviewState) => void;
}) {
  const form = intake.formData;
  const scopePages = scopePagesForDiscovery(brief);
  const scopeFeatures = scopeFeaturesForDiscovery(brief);

  return (
    <AdminDialog open={open} title="Discovery submission" description="Review client answers and uploaded files." onClose={onClose} size="lg">
      <div className="space-y-5 text-sm">
        <ReviewSection title="Business" state={discoverySectionSummary("business", intake, files)} onReview={onSectionReview} section="business">
          <p>{form.business.businessName} · {form.business.contactName}</p>
          <p className="text-[var(--admin-muted)]">{form.business.email} · {form.business.phone}</p>
        </ReviewSection>
        <ReviewSection title="Goals" state={discoverySectionSummary("goals", intake, files)} onReview={onSectionReview} section="goals">
          <p>{form.goals.mainGoals.join(", ")}</p>
          <p className="text-[var(--admin-muted)]">Visitors: {form.goals.visitorActions.join(", ")}</p>
        </ReviewSection>
        <ReviewSection title="Pages (from scope)" state={discoverySectionSummary("pages", intake, files)} onReview={onSectionReview} section="pages">
          <p>{scopePages.join(", ")}</p>
          {form.pages.clarification ? <p className="mt-1 text-[var(--admin-muted)]">{form.pages.clarification}</p> : null}
        </ReviewSection>
        <ReviewSection title="Branding" state={discoverySectionSummary("branding", intake, files)} onReview={onSectionReview} section="branding">
          <p>{form.branding.designStyles.join(", ") || "—"}</p>
          {form.branding.likedWebsites ? <p className="text-[var(--admin-muted)]">Likes: {form.branding.likedWebsites}</p> : null}
        </ReviewSection>
        <ReviewSection title="Features (from scope)" state={discoverySectionSummary("features", intake, files)} onReview={onSectionReview} section="features">
          <p>{scopeFeatures.join(", ") || "—"}</p>
        </ReviewSection>
        <ReviewSection title="Assets" state={discoverySectionSummary("content", intake, files)} onReview={onSectionReview} section="content">
          {files.length ? (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.id}>
                  <button type="button" className="text-[var(--admin-blue)] hover:underline" onClick={() => void signedUrlForPath(file.storagePath).then((url) => window.open(url, "_blank"))}>
                    {file.fileName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--admin-muted)]">No files uploaded.</p>
          )}
        </ReviewSection>
        <label className="block text-[13px] font-medium">Internal notes (not visible to client)
          <textarea rows={4} className="mt-1.5 w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3 py-2 text-sm" value={notes} onChange={(e) => onNotesChange(e.target.value)} />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={adminGhostBtn} onClick={onSaveNotes}>Save notes</button>
          <button type="button" className={adminGhostBtn} onClick={onMarkReview}>Mark under review</button>
          <button type="button" className={adminPrimaryBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </AdminDialog>
  );
}

function ReviewSection({
  title,
  state,
  section,
  onReview,
  children,
}: {
  title: string;
  state: DiscoverySectionReviewState;
  section: DiscoverySectionId;
  onReview: (section: DiscoverySectionId, state: DiscoverySectionReviewState) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--admin-line)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{title}</p>
        <select
          className="h-8 rounded border border-[var(--admin-line)] px-2 text-[12px]"
          value={state}
          onChange={(e) => onReview(section, e.target.value as DiscoverySectionReviewState)}
        >
          <option value="pending">Pending</option>
          <option value="ok">Reviewed</option>
          <option value="attention">Needs attention</option>
        </select>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function DiscoveryRequestMoreDialog({
  open,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSend: (missingItems: string[], message: string) => void;
}) {
  const [missing, setMissing] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setMissing([]);
      setMessage("");
    }
  }, [open]);

  return (
    <AdminDialog open={open} title="Request follow-up" description="Select what is missing and write a message for the client." onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--admin-muted)]">
          We need a little more information before we can finalize website requirements.
        </p>
        <div className="flex flex-wrap gap-2">
          {DISCOVERY_FOLLOW_UP_ITEMS.map((item) => {
            const active = missing.includes(item);
            return (
              <button
                key={item}
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-semibold",
                  active ? "border-[var(--admin-blue)] bg-[rgb(0_80_240_/_0.08)]" : "border-[var(--admin-line)]",
                )}
                onClick={() => setMissing((current) => (current.includes(item) ? current.filter((i) => i !== item) : [...current, item]))}
              >
                {item}
              </button>
            );
          })}
        </div>
        <textarea
          rows={6}
          className="w-full rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-3 py-2 text-sm"
          placeholder="Message to the client"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className={adminGhostBtn} onClick={onClose}>Cancel</button>
          <button type="button" disabled={busy || !message.trim()} className={adminPrimaryBtn} onClick={() => onSend(missing, message)}>
            Send Follow-Up to Client
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}
