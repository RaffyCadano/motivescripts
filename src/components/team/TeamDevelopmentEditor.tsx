import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  deploymentStatuses,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  type DeploymentStatus,
  type ProjectDevelopment,
} from "@/data/projectDevelopment";
import { upsertProjectDevelopment } from "@/data/agencyRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

type TeamDevelopmentEditorProps = {
  projectId: string;
  development: ProjectDevelopment;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Scoped to Development fields only -- does not touch name, status, billing,
 * or any other project field. Calls upsertProjectDevelopment directly rather
 * than the full-project updateProjectRecord, which would otherwise require
 * (and silently overwrite) every other field on the project row.
 */
export function TeamDevelopmentEditor({ projectId, development, onClose, onSaved }: TeamDevelopmentEditorProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ProjectDevelopment>(development);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch<K extends keyof ProjectDevelopment>(key: K, value: ProjectDevelopment[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await upsertProjectDevelopment(projectId, draft);
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save development information.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="admin-theme pointer-events-auto fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-[rgb(7_17_31_/_0.4)]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(38rem,calc(100svh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--admin-line)] px-5 py-4">
          <h2 id={titleId} className="font-heading text-lg font-semibold text-[var(--admin-ink)]">
            Edit deployment info
          </h2>
          <button
            ref={closeRef}
            type="button"
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-auto px-5 py-4" onSubmit={(event) => void onSubmit(event)}>
          <p className="text-sm text-[var(--admin-muted)]">
            Manual links to the repository and hosting. This does not change the project's status or any other field.
          </p>
          <label className="mt-4 block text-sm font-semibold">
            Repository URL
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              value={draft.repositoryUrl}
              disabled={busy}
              onChange={(event) => patch("repositoryUrl", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Branch
            <input
              value={draft.repositoryBranch}
              disabled={busy}
              onChange={(event) => patch("repositoryBranch", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Starter template repository
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="https://github.com/your-org/landscaping-starter"
              value={draft.templateRepositoryUrl}
              disabled={busy}
              onChange={(event) => patch("templateRepositoryUrl", event.target.value)}
              className={inputClass}
            />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Staging URL
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                value={draft.stagingUrl}
                disabled={busy}
                onChange={(event) => patch("stagingUrl", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Production URL
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                value={draft.productionUrl}
                disabled={busy}
                onChange={(event) => patch("productionUrl", event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Hosting provider
              <input
                value={draft.hostingProvider}
                disabled={busy}
                onChange={(event) => patch("hostingProvider", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Deployment status
              <select
                value={draft.deploymentStatus}
                disabled={busy}
                onChange={(event) => patch("deploymentStatus", event.target.value as DeploymentStatus)}
                className={inputClass}
              >
                {deploymentStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Last deployment
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(draft.lastDeployedAt)}
              disabled={busy}
              onChange={(event) => patch("lastDeployedAt", fromDatetimeLocalValue(event.target.value))}
              className={inputClass}
            />
          </label>

          {error ? <p className="mt-3 text-sm text-[#b45309]">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
