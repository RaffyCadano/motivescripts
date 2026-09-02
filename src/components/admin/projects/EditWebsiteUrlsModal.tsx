import { useState, type FormEvent } from "react";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { AgencyProject, ProjectDevelopment } from "@/data/agencyProjects";
import { upsertProjectDevelopment } from "@/data/agencyRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

type EditWebsiteUrlsModalProps = {
  project: AgencyProject;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function EditWebsiteUrlsModal({ project, open, onClose, onSaved }: EditWebsiteUrlsModalProps) {
  const [stagingUrl, setStagingUrl] = useState(project.development.stagingUrl);
  const [productionUrl, setProductionUrl] = useState(project.development.productionUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const development: ProjectDevelopment = {
        ...project.development,
        stagingUrl: stagingUrl.trim(),
        productionUrl: productionUrl.trim(),
      };
      await upsertProjectDevelopment(project.id, development);
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save website URLs.");
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (!busy) {
      setStagingUrl(project.development.stagingUrl);
      setProductionUrl(project.development.productionUrl);
      setError(null);
      onClose();
    }
  }

  return (
    <AdminDialog open={open} title="Edit website URLs" onClose={handleClose} busy={busy}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-semibold">
          Staging URL
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://staging.example.com"
            value={stagingUrl}
            onChange={(e) => setStagingUrl(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-semibold">
          Production URL
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.example.com"
            value={productionUrl}
            onChange={(e) => setProductionUrl(e.target.value)}
            className={inputClass}
          />
        </label>
        {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button type="button" className={`${adminGhostBtn} justify-center`} disabled={busy} onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className={`${adminPrimaryBtn} justify-center`} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
