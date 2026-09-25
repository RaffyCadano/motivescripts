import { useState } from "react";
import { PauseCircle } from "lucide-react";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { formatProjectDay, type AgencyProject } from "@/data/agencyProjects";
import { retryHostSiteControl, unpauseWebsite } from "@/data/websitePauseRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const choices = [
  { id: "7", label: "7 more days", days: 7 as number | null },
  { id: "30", label: "30 more days", days: 30 as number | null },
  { id: "keep", label: "Keep live indefinitely", days: null as number | null },
] as const;

/**
 * Shown on a project whose website was paused because the free launch period ended with no Care plan (and,
 * if the site is still paused on Vercel after an unpause, until that is sorted out too). "Paused" is a status:
 * for a project opted in to automatic pause the system also pauses it on Vercel and this shows the result,
 * with a Retry when Vercel refused; otherwise the staff alert is the prompt to take the site offline at the
 * host. Unpause never restarts the free period by itself: the admin picks a short grace period, or keeps it
 * live for good, and a client getting an active plan unpauses it automatically.
 */
export function ProjectWebsitePauseBanner({ project, canManage }: { project: AgencyProject; canManage: boolean }) {
  const { notify, reload } = useLeads();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<(typeof choices)[number]["id"]>("7");
  const [busy, setBusy] = useState(false);
  const dev = project.development;
  const pausedAt = dev.pausedAt;
  const stuckOnHost = !pausedAt && Boolean(dev.hostPausedAt); // unpaused here, but Vercel still shows it paused
  if (!pausedAt && !stuckOnHost) return null;

  async function onUnpause() {
    const picked = choices.find((item) => item.id === choice) ?? choices[0];
    setBusy(true);
    try {
      await unpauseWebsite(project.id, picked.days);
      notify(picked.days === null ? "Website unpaused and kept live." : `Website unpaused for ${picked.days} more days.`);
      await reload();
      setOpen(false);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to unpause this website.");
    } finally {
      setBusy(false);
    }
  }

  async function onRetry() {
    setBusy(true);
    try {
      await retryHostSiteControl(project.id);
      notify("Asked Vercel again. Refresh in a few seconds to see the result.");
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to retry on Vercel.");
    } finally {
      setBusy(false);
    }
  }

  const auto = dev.autoPauseOnVercel && Boolean(dev.vercelProjectId);
  let hostLine: string | null = null;
  if (auto) {
    if (pausedAt && dev.hostPausedAt) hostLine = "Vercel: paused ✓";
    else if (dev.hostPauseError) hostLine = `Vercel: automatic ${pausedAt ? "pause" : "unpause"} failed. ${dev.hostPauseError}`;
    else hostLine = pausedAt ? "Vercel: pause requested. Refresh in a few seconds." : "Vercel: unpause requested. Refresh in a few seconds.";
  }
  const showRetry = canManage && auto && Boolean(dev.hostPauseError);

  return (
    <section role="status" className="rounded-[var(--admin-radius)] border border-amber-300 bg-amber-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <PauseCircle size={22} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold text-amber-950">
              {pausedAt ? "Website paused" : "Unpaused here, but still paused on Vercel"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-amber-950/80">
              {pausedAt ? (
                <>
                  {dev.pauseReason === "manual"
                    ? `This website was paused by hand on ${formatProjectDay(pausedAt)}. ${
                        dev.pauseClientVisible
                          ? "The client has been told" + (dev.pauseClientNote ? ` (note: “${dev.pauseClientNote}”).` : ".")
                          : "The client has not been told and doesn’t see it as paused."
                      }`
                    : `The free launch period ended and there is no active Care plan, so this website was paused on ${formatProjectDay(pausedAt)}. The client has been told.`}{" "}
                  {auto
                    ? "Vercel is asked to pause the site automatically."
                    : "Take the site offline at the host if you haven’t yet; unpausing here doesn’t switch the host back on."}
                </>
              ) : (
                "The website is no longer paused in the system, but Vercel still has it paused."
              )}
            </p>
            {hostLine ? <p className="mt-2 text-sm font-medium text-amber-950">{hostLine}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {showRetry ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRetry()}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
            >
              {busy ? "Working…" : "Retry on Vercel"}
            </button>
          ) : null}
          {canManage && pausedAt && !open ? (
            <button type="button" onClick={() => setOpen(true)} className={adminPrimaryBtn}>
              Unpause website
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-4 border-t border-amber-200 pt-4">
          <fieldset>
            <legend className="text-sm font-semibold text-amber-950">Unpause for</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {choices.map((item) => (
                <label
                  key={item.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-[var(--admin-ink)] has-[:checked]:border-[var(--admin-blue)] has-[:checked]:bg-[rgb(0_80_240_/_0.06)]"
                >
                  <input
                    type="radio"
                    name="unpause-choice"
                    value={item.id}
                    checked={choice === item.id}
                    onChange={() => setChoice(item.id)}
                    className="accent-[var(--admin-blue)]"
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-amber-950/70">
              The client is reminded again before a grace period ends. A client who buys a Care plan is unpaused automatically.
              {auto ? " Vercel is unpaused automatically too." : ""}
            </p>
          </fieldset>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void onUnpause()} className={`${adminPrimaryBtn} disabled:opacity-60`}>
              {busy ? "Unpausing…" : "Confirm unpause"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-amber-950/80 hover:text-amber-950"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
