import { useEffect, useMemo, useState } from "react";
import {
  Code2,
  Database,
  Globe,
  KeyRound,
  Mail,
  PencilLine,
  Trash2,
  Triangle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { adminBlueBtn } from "@/components/admin/adminActionStyles";
import { ClientAccountFormModal } from "@/components/admin/projects/ClientAccountFormModal";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import type { AgencyProject } from "@/data/agencyProjects";
import {
  clientAccountDisplayName,
  clientAccountStatusLabel,
  sortClientProjectAccounts,
  type ClientAccountStatus,
  type ClientProjectAccount,
  type ClientProjectAccountDraft,
} from "@/data/clientProjectAccounts";
import {
  createClientProjectAccount,
  deleteClientProjectAccount,
  listClientProjectAccounts,
  setClientProjectAccountStatus,
  updateClientProjectAccount,
} from "@/data/clientProjectAccountsRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const SERVICE_ICONS: Record<ClientProjectAccount["service"], LucideIcon> = {
  vercel: Triangle,
  github: Code2,
  supabase: Database,
  email: Mail,
  domain: Globe,
  other: KeyRound,
};

const STATUS_TONE: Record<ClientAccountStatus, string> = {
  needs_invite: "bg-[rgb(245_158_11_/_0.14)] text-[#92610a]",
  invited: "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]",
  active: "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
};

/**
 * The checklist of third-party accounts a client needs for this project, and whether they've been invited.
 * Deliberately holds no password: the guidance shown here is to add the client as a collaborator on the service
 * itself, under their own email, rather than to share a login.
 */
export function ProjectAccessPanel({ project }: { project: AgencyProject }) {
  const { profile } = useAuth();
  const canManage = hasPermission(profile, "projects.manage");
  const [accounts, setAccounts] = useState<ClientProjectAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientProjectAccount | null>(null);
  const [removing, setRemoving] = useState<ClientProjectAccount | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setAccounts(await listClientProjectAccounts(project.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load this project's accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const sorted = useMemo(() => sortClientProjectAccounts(accounts), [accounts]);

  async function handleSubmit(draft: ClientProjectAccountDraft) {
    try {
      if (editing) await updateClientProjectAccount(editing.id, draft);
      else await createClientProjectAccount(project.id, draft);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save this account.");
    }
  }

  async function handleStatusChange(account: ClientProjectAccount, status: ClientAccountStatus) {
    setAccounts((current) => current.map((item) => (item.id === account.id ? { ...item, status } : item)));
    try {
      await setClientProjectAccountStatus(account.id, status);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update this account.");
      await reload();
    }
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteClientProjectAccount(removing.id);
      setRemoving(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove this account.");
    } finally {
      setBusy(false);
    }
  }

  function menuItems(account: ClientProjectAccount): AdminActionsMenuItem[] {
    return [
      {
        id: "edit",
        label: "Edit",
        icon: PencilLine,
        onSelect: () => {
          setEditing(account);
          setFormOpen(true);
        },
      },
      { id: "remove", label: "Remove", icon: Trash2, danger: true, separatorBefore: true, onSelect: () => setRemoving(account) },
    ];
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Client access</h2>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-[var(--admin-muted)]">
            Track which accounts this client needs and whether they&rsquo;ve been invited. No password is stored here
            &mdash; add them as a collaborator on each service (under their own email) instead of sharing a login.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className={`${adminBlueBtn} justify-center`}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + Add account
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-[#b45309]">{error}</p> : null}

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[var(--admin-bg)]" />
      ) : sorted.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--admin-line)] px-4 py-8 text-center text-sm text-[var(--admin-muted)]">
          No accounts tracked yet for this project.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--admin-line)]">
          {sorted.map((account) => {
            const Icon = SERVICE_ICONS[account.service];
            return (
              <li key={account.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                    <Icon size={15} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-sm font-semibold text-[var(--admin-ink)]">{clientAccountDisplayName(account)}</p>
                    {account.username ? <p className="truncate text-[12px] text-[var(--admin-muted)]">{account.username}</p> : null}
                    {account.loginUrl ? (
                      <a
                        href={account.loginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 block truncate text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
                      >
                        {account.loginUrl}
                      </a>
                    ) : null}
                    {account.notes ? <p className="mt-1 text-[12px] leading-snug text-[var(--admin-muted)]">{account.notes}</p> : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canManage ? (
                    <select
                      value={account.status}
                      onChange={(event) => void handleStatusChange(account, event.target.value as ClientAccountStatus)}
                      className={cn(
                        "h-8 rounded-full border-0 px-3 font-heading text-xs font-semibold outline-none",
                        STATUS_TONE[account.status],
                      )}
                    >
                      {(["needs_invite", "invited", "active"] as const).map((status) => (
                        <option key={status} value={status}>
                          {clientAccountStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={cn("rounded-full px-2.5 py-1 font-heading text-xs font-semibold", STATUS_TONE[account.status])}>
                      {clientAccountStatusLabel(account.status)}
                    </span>
                  )}
                  {canManage ? <AdminActionsMenu ariaLabel={`Actions for ${clientAccountDisplayName(account)}`} iconOnly items={menuItems(account)} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ClientAccountFormModal
        open={formOpen}
        account={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={(draft) => void handleSubmit(draft)}
      />

      <ConfirmDocumentModal
        open={Boolean(removing)}
        danger
        title="Remove this account?"
        description={removing ? `Removes “${clientAccountDisplayName(removing)}” from this project's checklist. This only removes the tracking entry -- it does not revoke any access on the service itself.` : ""}
        actionLabel="Remove"
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  );
}
