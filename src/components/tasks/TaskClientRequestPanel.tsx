import { useEffect, useState } from "react";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import {
  completeTaskClientRequest,
  fetchTaskClientRequestByTask,
  fetchTaskClientRequestFiles,
  markTaskClientRequestUnderReview,
  sendTaskClientRequest,
} from "@/data/taskClientRequestsRepository";
import { taskClientRequestStatusLabel, type TaskClientRequest, type TaskClientRequestFile } from "@/data/taskClientRequests";
import { signedUrlForPath } from "@/data/fileStorage";
import { AgencyDbError } from "@/lib/dbErrors";

type TaskClientRequestPanelProps = {
  taskId: string;
  projectId: string;
  clientId: string;
};

/** PM-facing "request info/files from client" workspace for content_collection tasks. */
export function TaskClientRequestPanel({ taskId, projectId, clientId }: TaskClientRequestPanelProps) {
  const [request, setRequest] = useState<TaskClientRequest | null>(null);
  const [files, setFiles] = useState<TaskClientRequestFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function reload() {
    const row = await fetchTaskClientRequestByTask(taskId);
    setRequest(row);
    if (row) {
      setFiles(await fetchTaskClientRequestFiles(row.id));
      if (!message) setMessage(row.message);
    } else {
      setFiles([]);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void reload()
      .catch(() => {
        if (active) setError("Unable to load this client request.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this request.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--admin-muted)]">Loading request…</p>;
  }

  const status = request?.status ?? "not_requested";

  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Client Request</h3>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">
          {taskClientRequestStatusLabel(status)}
        </span>
      </div>

      {error ? <p className="mt-2 text-sm text-[#b45309]">{error}</p> : null}

      {status === "not_requested" || status === "awaiting_client" ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[12px] font-medium text-[var(--admin-ink)]">
            What do you need from the client?
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="e.g. Please upload your logo files and a short description of each service."
            />
          </label>
          <button
            type="button"
            disabled={busy || !message.trim()}
            className={adminPrimaryBtn}
            onClick={() =>
              void run(() =>
                sendTaskClientRequest({ taskId, projectId, clientId, message }).then(() => undefined),
              )
            }
          >
            {status === "awaiting_client" ? "Resend Request" : "Request from Client"}
          </button>
        </div>
      ) : null}

      {status === "submitted" || status === "under_review" || status === "complete" ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[12px] font-semibold text-[var(--admin-ink)]">Client response</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--admin-ink)]">
              {request?.clientResponse.trim() || "No written response."}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[var(--admin-ink)]">Files</p>
            {files.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--admin-muted)]">No files uploaded.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      className="text-sm text-[var(--admin-blue)] hover:underline"
                      onClick={() => void signedUrlForPath(file.storagePath).then((url) => window.open(url, "_blank"))}
                    >
                      {file.fileName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "submitted" ? (
              <button
                type="button"
                disabled={busy}
                className={adminGhostBtn}
                onClick={() => void run(() => markTaskClientRequestUnderReview(request!.id).then(() => undefined))}
              >
                Mark Under Review
              </button>
            ) : null}
            {status !== "complete" ? (
              <button
                type="button"
                disabled={busy}
                className={adminPrimaryBtn}
                onClick={() => void run(() => completeTaskClientRequest(request!.id).then(() => undefined))}
              >
                Mark Complete
              </button>
            ) : null}
            {status !== "complete" ? (
              <button
                type="button"
                disabled={busy}
                className={adminGhostBtn}
                onClick={() => setMessage(request?.message ?? "")}
              >
                Request More
              </button>
            ) : null}
          </div>
          {status !== "complete" && message !== request?.message ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                className="w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="What else do you need?"
              />
              <button
                type="button"
                disabled={busy || !message.trim()}
                className={adminPrimaryBtn}
                onClick={() =>
                  void run(() =>
                    sendTaskClientRequest({ taskId, projectId, clientId, message }).then(() => undefined),
                  )
                }
              >
                Send Follow-Up Request
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
