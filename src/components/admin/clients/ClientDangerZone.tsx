import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { adminDangerBtn } from "@/components/admin/adminActionStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import type { AgencyClient } from "@/data/agencyClients";
import { deletionSummaryLines, type ClientDeletionPreview } from "@/data/clientDeletion";
import { deleteClientEverything, fetchClientDeletionPreview } from "@/data/clientDeletionRepository";
import { AgencyDbError } from "@/lib/dbErrors";

/**
 * Admin only: delete this client and everything that belongs to them (projects, files, proposals, contracts,
 * invoices and payments, messages, plans, requests, and their portal logins). Guarded by typing the business
 * name, an active Care plan blocks it, and a live website has to be taken down first (or explicitly left
 * running). The confirmation shows exactly what will go.
 */
export function ClientDangerZone({ client }: { client: AgencyClient }) {
  const { profile } = useAuth();
  const { reload, notify } = useLeads();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ClientDeletionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [understand, setUnderstand] = useState(false);
  const [leaveLive, setLeaveLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    setPreview(null);
    fetchClientDeletionPreview(client.id)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((caught) => {
        if (active) setLoadError(caught instanceof AgencyDbError ? caught.message : "Unable to load what would be deleted.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, client.id]);

  if (!isActiveAdmin(profile)) return null;

  function openDialog() {
    setTyped("");
    setUnderstand(false);
    setLeaveLive(false);
    setError(null);
    setOpen(true);
  }

  const nameMatches = typed.trim().toLowerCase() === client.businessName.trim().toLowerCase();
  const hasFinancials = Boolean(preview && (preview.invoices > 0 || preview.contracts > 0 || preview.proposals > 0));
  const liveSites = preview?.liveWebsites ?? [];
  const blockedByPlan = Boolean(preview?.hasActivePlan);
  const blockedByLiveSite = liveSites.length > 0 && !leaveLive;
  const canConfirm = Boolean(preview) && nameMatches && (!hasFinancials || understand) && !blockedByPlan && !blockedByLiveSite;

  async function confirm() {
    if (!canConfirm || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteClientEverything(client.id, client.businessName, leaveLive);
      notify(`Deleted ${client.businessName} and everything that belonged to them.`);
      setOpen(false);
      await reload();
      navigate("/admin/clients");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this client.");
    } finally {
      setBusy(false);
    }
  }

  const lines = preview ? deletionSummaryLines(preview) : [];

  return (
    <section id="delete-client" className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[rgb(180_35_24_/_0.28)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[#b42318]">Danger zone</h2>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--admin-ink)]">Delete this client and everything</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">
            Permanently deletes {client.businessName} with their projects, files, proposals, contracts, invoices and payments, messages, plans
            and portal logins. This can&rsquo;t be undone. It does not take a live website down at the host; do that first from{" "}
            <Link to="/admin/accounts" className="font-semibold text-[var(--admin-blue)] hover:underline">
              Accounts
            </Link>
            .
          </p>
        </div>
        <button type="button" className={`${adminDangerBtn} shrink-0 gap-1.5`} onClick={openDialog}>
          <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
          Delete client…
        </button>
      </div>

      <ConfirmDocumentModal
        open={open}
        danger
        busy={busy}
        title={`Delete ${client.businessName}?`}
        description={
          loading ? (
            "Checking what would be deleted…"
          ) : loadError ? (
            loadError
          ) : preview ? (
            <span className="block space-y-3">
              <span className="block">This permanently deletes the client and everything below. It can&rsquo;t be undone.</span>
              {lines.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <span className="block">This client has no projects, documents or logins yet.</span>
              )}
              {blockedByPlan ? (
                <span className="block font-medium text-[#b42318]">
                  This client still has an active Website Care plan. Cancel the plan first; they can&rsquo;t be deleted until then.
                </span>
              ) : null}
              {liveSites.length > 0 ? (
                <span className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                  Live website{liveSites.length === 1 ? "" : "s"}: <strong>{liveSites.join(", ")}</strong>. Deleting the client does not take{" "}
                  {liveSites.length === 1 ? "it" : "them"} offline. Take {liveSites.length === 1 ? "it" : "them"} down first from Accounts, or choose to
                  leave {liveSites.length === 1 ? "it" : "them"} running below.
                </span>
              ) : null}
            </span>
          ) : null
        }
        actionLabel="Delete client and everything"
        confirmDisabled={!canConfirm}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        onConfirm={() => void confirm()}
        extra={
          preview ? (
            <div className="space-y-3">
              {liveSites.length > 0 ? (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={leaveLive} onChange={(event) => setLeaveLive(event.target.checked)} className="mt-0.5 size-4" />
                  <span>Leave the website running at the host. I&rsquo;ll deal with it there.</span>
                </label>
              ) : null}
              {hasFinancials ? (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={understand} onChange={(event) => setUnderstand(event.target.checked)} className="mt-0.5 size-4" />
                  <span>I understand this deletes their proposals, contracts, invoices and payment records too.</span>
                </label>
              ) : null}
              <label className="block text-sm font-semibold">
                Type <span className="font-mono text-[13px]">{client.businessName}</span> to confirm
                <input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                />
              </label>
              {busy ? <p className="text-sm text-[var(--admin-muted)]">Deleting… this can take a few seconds.</p> : null}
              {error ? (
                <p role="alert" className="text-sm text-[#b42318]">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null
        }
      />
    </section>
  );
}
