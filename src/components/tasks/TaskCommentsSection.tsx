import { useEffect, useState, type FormEvent } from "react";
import { addTaskComment, listTaskComments } from "@/data/taskCommentsRepository";
import type { TaskComment } from "@/data/taskComments";
import { formatProjectDay } from "@/data/agencyProjects";
import { AgencyDbError } from "@/lib/dbErrors";

export function TaskCommentsSection({
  taskId,
  projectId,
  authorLabel,
}: {
  taskId: string;
  projectId: string;
  authorLabel: string;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setComments(await listTaskComments(taskId));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load comments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await addTaskComment({ taskId, projectId, authorLabel, body });
      setComments((current) => [...current, comment]);
      setBody("");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to post this comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 border-t border-[var(--admin-line)] pt-6">
      <h3 className="font-heading text-sm font-semibold">Comments</h3>
      {loading ? (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">No comments yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-[var(--admin-bg)] px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-semibold text-[var(--admin-ink)]">{comment.authorLabel}</p>
                <p className="text-[11px] text-[var(--admin-muted)]">{formatProjectDay(comment.createdAt)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--admin-ink)]">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-3 flex items-end gap-2" onSubmit={(event) => void onSubmit(event)}>
        <textarea
          rows={2}
          value={body}
          disabled={busy}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Leave a note on this task…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="h-10 shrink-0 rounded-lg bg-[var(--admin-navy)] px-3 font-heading text-[12px] font-semibold text-white disabled:opacity-50"
        >
          Post
        </button>
      </form>
      {error ? <p className="mt-2 text-[12px] text-[#b45309]">{error}</p> : null}
    </section>
  );
}
