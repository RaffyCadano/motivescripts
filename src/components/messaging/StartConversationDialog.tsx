import { useEffect, useId, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { MESSAGE_MAX_LENGTH, SUBJECT_MAX_LENGTH, type MessagingTone } from "@/data/messaging";
import { messagingClasses } from "@/components/messaging/messagingTheme";
import { cn } from "@/lib/cn";

export type ConversationDraft = {
  subject: string;
  body: string;
  clientId: string;
  projectId: string;
};

type ClientOption = { id: string; businessName: string };
type ProjectOption = { id: string; name: string; clientId: string };

type StartConversationDialogProps = {
  open: boolean;
  tone: MessagingTone;
  canPickClient: boolean;
  clients: ClientOption[];
  projects: ProjectOption[];
  initialClientId?: string;
  initialProjectId?: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: ConversationDraft) => Promise<boolean>;
};

export function StartConversationDialog({
  open,
  tone,
  canPickClient,
  clients,
  projects,
  initialClientId = "",
  initialProjectId = "",
  busy,
  onClose,
  onSubmit,
}: StartConversationDialogProps) {
  const titleId = useId();
  const styles = messagingClasses(tone);
  const [clientId, setClientId] = useState(initialClientId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    setClientId(initialClientId);
    setProjectId(initialProjectId);
    setSubject("");
    setBody("");
  }, [initialClientId, initialProjectId, open]);

  const projectOptions = canPickClient ? projects.filter((item) => !clientId || item.clientId === clientId) : projects;
  const valid =
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    body.trim().length <= MESSAGE_MAX_LENGTH &&
    subject.trim().length <= SUBJECT_MAX_LENGTH &&
    (!canPickClient || Boolean(clientId));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    const ok = await onSubmit({
      subject: subject.trim(),
      body: body.trim(),
      clientId,
      projectId,
    });
    if (ok) onClose();
  }

  const fields = (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      {canPickClient ? (
        <div>
          <label htmlFor={`${titleId}-client`} className={cn("block font-heading text-sm font-semibold", styles.ink)}>
            Client
          </label>
          <select
            id={`${titleId}-client`}
            required
            value={clientId}
            disabled={busy}
            onChange={(event) => {
              setClientId(event.target.value);
              setProjectId("");
            }}
            className={cn(styles.control, styles.controlBorder, styles.ink, "mt-1.5")}
          >
            <option value="">Select a client</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.businessName}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label htmlFor={`${titleId}-project`} className={cn("block font-heading text-sm font-semibold", styles.ink)}>
          Project <span className={styles.muted}>(optional)</span>
        </label>
        <select
          id={`${titleId}-project`}
          value={projectId}
          disabled={busy || (canPickClient && !clientId)}
          onChange={(event) => setProjectId(event.target.value)}
          className={cn(styles.control, styles.controlBorder, styles.ink, "mt-1.5")}
        >
          <option value="">No project</option>
          {projectOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${titleId}-subject`} className={cn("block font-heading text-sm font-semibold", styles.ink)}>
          Subject
        </label>
        <input
          id={`${titleId}-subject`}
          required
          maxLength={SUBJECT_MAX_LENGTH}
          value={subject}
          disabled={busy}
          onChange={(event) => setSubject(event.target.value)}
          className={cn(styles.control, styles.controlBorder, styles.ink, "mt-1.5")}
        />
      </div>
      <div>
        <label htmlFor={`${titleId}-body`} className={cn("block font-heading text-sm font-semibold", styles.ink)}>
          Message
        </label>
        <textarea
          id={`${titleId}-body`}
          required
          rows={5}
          maxLength={MESSAGE_MAX_LENGTH}
          value={body}
          disabled={busy}
          onChange={(event) => setBody(event.target.value)}
          className={cn(styles.control, styles.controlBorder, styles.ink, "mt-1.5 resize-y")}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border bg-white px-4 font-heading text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            styles.controlBorder,
            styles.ink,
            styles.hover,
          )}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid || busy}
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-50",
            styles.blueBtn,
          )}
        >
          {busy ? "Starting…" : "Send"}
        </button>
      </div>
    </form>
  );

  if (tone === "admin") {
    return (
      <AdminDialog
        open={open}
        title="New conversation"
        description="Start a thread with this client. The first message is saved with the conversation."
        busy={busy}
        onClose={onClose}
      >
        {fields}
      </AdminDialog>
    );
  }

  if (!open) return null;

  return (
    <div className="client-theme fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[min(40rem,calc(100svh-2rem))] w-full max-w-lg overflow-auto rounded-[var(--client-radius)] border border-[var(--client-line)] bg-white p-6 shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
      >
        <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
          New message
        </h2>
        <p className="mt-2 text-sm text-[var(--client-muted)]">Write MotiveScripts about your project.</p>
        <div className="mt-5">{fields}</div>
      </div>
    </div>
  );
}
