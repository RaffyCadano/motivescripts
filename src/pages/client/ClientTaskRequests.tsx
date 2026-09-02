import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { formatClientDate } from "@/data/agencyClients";
import {
  fetchTaskClientRequestFiles,
  fetchTaskClientRequestsForProject,
  insertTaskClientRequestFile,
  submitTaskClientResponse,
} from "@/data/taskClientRequestsRepository";
import { taskClientRequestStatusLabel, type TaskClientRequest, type TaskClientRequestFile } from "@/data/taskClientRequests";
import { uploadTaskRequestFile, signedUrlForPath } from "@/data/fileStorage";
import { fileExtension } from "@/data/fileUploadConfig";
import { AgencyDbError } from "@/lib/dbErrors";

export function ClientTaskRequests() {
  const { projectId } = useParams();
  const session = usePortalSession();
  const project = projectId ? (session.projects.find((item) => item.id === projectId) ?? null) : session.project;

  const [requests, setRequests] = useState<TaskClientRequest[]>([]);
  const [filesByRequest, setFilesByRequest] = useState<Record<string, TaskClientRequestFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!project?.id) return;
    const rows = await fetchTaskClientRequestsForProject(project.id);
    setRequests(rows);
    const entries = await Promise.all(
      rows.map(async (row) => [row.id, await fetchTaskClientRequestFiles(row.id)] as const),
    );
    setFilesByRequest(Object.fromEntries(entries));
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    void reload()
      .catch(() => {
        if (active) setError("Unable to load requests.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)]" />;
  }

  const pending = requests.filter((item) => item.status === "awaiting_client");
  const past = requests.filter((item) => item.status !== "awaiting_client" && item.status !== "not_requested");

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Requests from MotiveScripts</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--client-muted)]">
          Information or files your project manager needs from you to keep production moving.
        </p>
      </header>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {pending.length === 0 && past.length === 0 ? (
        <div className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-6">
          <p className="text-sm text-[var(--client-muted)]">Nothing needed from you right now.</p>
        </div>
      ) : null}

      {pending.map((request) => (
        <PendingRequestCard
          key={request.id}
          request={request}
          files={filesByRequest[request.id] ?? []}
          onSubmitted={() => void reload()}
        />
      ))}

      {past.length > 0 ? (
        <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
          <h2 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Past requests</h2>
          <ul className="mt-3 space-y-3">
            {past.map((request) => (
              <li key={request.id} className="rounded-lg border border-[var(--client-line)] p-3">
                <p className="text-sm font-medium text-[var(--client-ink)]">{request.message}</p>
                <p className="mt-1 text-[12px] text-[var(--client-muted)]">
                  {taskClientRequestStatusLabel(request.status)}
                  {request.submittedAt ? ` · Submitted ${formatClientDate(request.submittedAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PendingRequestCard({
  request,
  files,
  onSubmitted,
}: {
  request: TaskClientRequest;
  files: TaskClientRequestFile[];
  onSubmitted: () => void;
}) {
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState<"upload" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState(files);

  async function onUpload(fileList: FileList | null) {
    if (!fileList?.length || busy) return;
    const file = fileList[0];
    setBusy("upload");
    setError(null);
    try {
      const fileId = crypto.randomUUID();
      const storagePath = await uploadTaskRequestFile({
        projectId: request.projectId,
        requestId: request.id,
        fileId,
        file,
      });
      const row = await insertTaskClientRequestFile({
        requestId: request.id,
        taskId: request.taskId,
        projectId: request.projectId,
        clientId: request.clientId,
        fileName: file.name,
        fileType: fileExtension(file.name).toUpperCase() || "Other",
        fileSize: file.size,
        storagePath,
      });
      setLocalFiles((current) => [row, ...current]);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to upload file.");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    setBusy("submit");
    setError(null);
    try {
      await submitTaskClientResponse(request.taskId, response);
      onSubmitted();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to submit your response.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
      <p className="font-heading text-sm font-semibold text-[var(--client-ink)]">What we need</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--client-ink)]">{request.message}</p>

      <label className="mt-4 block">
        <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">Your response (optional)</span>
        <textarea
          rows={4}
          className="mt-2 w-full rounded-lg border border-[var(--client-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          placeholder="Add any notes here."
        />
      </label>

      <div className="mt-4">
        <span className="font-heading text-sm font-semibold text-[var(--client-ink)]">Files</span>
        {localFiles.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {localFiles.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  className="text-sm text-[var(--client-blue)] hover:underline"
                  onClick={() => void signedUrlForPath(file.storagePath).then((url) => window.open(url, "_blank"))}
                >
                  {file.fileName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <label className="mt-2 inline-flex h-10 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]">
          {busy === "upload" ? "Uploading…" : "Upload a file"}
          <input type="file" className="hidden" disabled={busy !== null} onChange={(event) => void onUpload(event.target.files)} />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void onSubmit()}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)] disabled:opacity-60"
      >
        {busy === "submit" ? "Submitting…" : "Submit Response"}
      </button>
    </section>
  );
}
