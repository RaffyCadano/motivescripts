import { useState } from "react";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import type { AgencyProject } from "@/data/agencyProjects";
import { pauseWebsite } from "@/data/websitePauseRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]";

/**
 * "Pause this website now": a manual pause for reasons the system can't see (an unpaid invoice, a client asking
 * to take it down). Same status as the automatic pause, so Unpause and the plan-starts trigger work unchanged.
 */
export function PauseWebsiteDialog({
  project,
  open,
  onClose,
  takeDown = false,
}: {
  project: AgencyProject;
  open: boolean;
  onClose: () => void;
  /** Worded as "Take down" (from the Accounts page) instead of "Pause"; it does exactly the same thing. */
  takeDown?: boolean;
}) {
  const { notify, reload } = useLeads();
  const [note, setNote] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [busy, setBusy] = useState(false);
  const auto = project.development.autoPauseOnVercel && Boolean(project.development.vercelProjectId);

  async function onConfirm() {
    setBusy(true);
    try {
      await pauseWebsite(project.id, note, notifyClient);
      notify(auto ? "Website paused. Vercel is being asked to pause the site." : "Website paused. Take the site offline at the host.");
      await reload();
      setNote("");
      setNotifyClient(true);
      onClose();
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to pause this website.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDocumentModal
      open={open}
      danger
      busy={busy}
      title={takeDown ? "Take down this website?" : "Pause this website?"}
      description={
        auto
          ? "The project is marked Paused and the site is paused on Vercel. Visitors will see Vercel’s “paused” page until you unpause it."
          : "The project is marked Paused and your team is alerted to take the site offline at the host. This system can’t switch the host off itself unless Automatic pause on Vercel is turned on for the project."
      }
      actionLabel={takeDown ? "Take down website" : "Pause website"}
      confirmDisabled={note.length > 500}
      onClose={() => {
        if (!busy) onClose();
      }}
      onConfirm={() => void onConfirm()}
      extra={
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            Note for the client <span className="font-normal text-[var(--admin-muted)]">(optional, shown to them)</span>
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={!notifyClient}
              placeholder="For example: Your website is paused while invoice 1042 is outstanding."
              className={fieldClass}
            />
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={notifyClient}
              onChange={(event) => setNotifyClient(event.target.checked)}
              className="mt-1 size-4 accent-[var(--admin-blue)]"
            />
            <span>
              Tell the client: they get an email and a banner in their portal.
              <span className="mt-0.5 block text-[12px] text-[var(--admin-muted)]">
                Untick to pause it for staff only. The client’s portal won’t show it as paused.
              </span>
            </span>
          </label>
        </div>
      }
    />
  );
}
