import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PowerOff, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { adminDangerBtn } from "@/components/admin/adminActionStyles";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { adminFilterControlState, adminStatusChipClass } from "@/components/admin/list/adminListStyles";
import { PauseWebsiteDialog } from "@/components/admin/projects/PauseWebsiteDialog";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { accountRoleLabel, type AccountDeletion, type AccountRow } from "@/data/accounts";
import { deleteAccount, listAccountDeletions, listAccounts } from "@/data/accountsRepository";
import type { AgencyProject } from "@/data/agencyProjects";
import { formatClientDate } from "@/data/agencyClients";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type RoleFilter = "all" | "client" | "team";

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "client", label: "Clients" },
  { key: "team", label: "Team" },
];

/**
 * Every login in the workspace, with two admin actions: delete an account, and take a client's website down.
 * Deleting a login does not remove the client's records or their website; taking a site down does not delete
 * anything. They are separate on purpose.
 */
export function AdminAccounts() {
  const { profile } = useAuth();
  const { projects, notify } = useLeads();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [deletions, setDeletions] = useState<AccountDeletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<AccountRow | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [takeDown, setTakeDown] = useState<AgencyProject | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [rows, gone] = await Promise.all([listAccounts(), listAccountDeletions().catch(() => [] as AccountDeletion[])]);
      setAccounts(rows);
      setDeletions(gone);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const term = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      accounts.filter((account) => {
        if (filter === "client" && account.role !== "client") return false;
        if (filter === "team" && account.role === "client") return false;
        if (!term) return true;
        return [account.fullName, account.email, account.businessName, accountRoleLabel(account)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      }),
    [accounts, filter, term],
  );

  /** The launched websites of a client account. */
  function sitesFor(account: AccountRow): AgencyProject[] {
    if (!account.clientId) return [];
    return projects.filter(
      (project) => project.clientId === account.clientId && !project.archived && project.development.deploymentStatus === "Production",
    );
  }

  function openDelete(account: AccountRow) {
    setDeleting(account);
    setTyped("");
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount(deleting.userId, typed);
      notify(`Deleted the account for ${deleting.email}.`);
      setDeleting(null);
      await load();
    } catch (caught) {
      setDeleteError(caught instanceof AgencyDbError ? caught.message : "Unable to delete this account.");
    } finally {
      setBusy(false);
    }
  }

  if (!isActiveAdmin(profile)) {
    return (
      <div>
        <AdminPageHeader title="Accounts" description="Admins can see and delete accounts here." />
        <p className="mt-6 text-sm text-[var(--admin-muted)]">You don&rsquo;t have permission to view this page.</p>
      </div>
    );
  }

  const emailMatches = Boolean(deleting) && typed.trim().toLowerCase() === (deleting?.email ?? "").trim().toLowerCase();

  return (
    <div>
      <AdminPageHeader
        title="Accounts"
        description="Every login in the workspace. Delete an account, or take a client's website down. They are separate actions: deleting a login keeps the client's records and does not take their website offline."
      />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search accounts</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, or business"
            className={adminFilterControlState(Boolean(term))}
          />
        </label>
        <div className="flex gap-2">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" className={adminStatusChipClass(filter === item.key)} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 h-40 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
      ) : error ? (
        <p className="mt-6 text-sm text-[#b45309]">{error}</p>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10 text-center text-sm text-[var(--admin-muted)]">
          No accounts match.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--admin-bg)] text-left text-[12px] text-[var(--admin-muted)]">
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                <th className="px-4 py-2.5 font-medium">Website</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-line)]">
              {visible.map((account) => {
                const sites = sitesFor(account);
                return (
                  <tr key={account.userId} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--admin-ink)]">
                        {account.fullName || account.email}
                        {account.isSelf ? (
                          <span className="ml-2 rounded-full bg-[rgb(0_80_240_/_0.08)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[var(--admin-blue)]">
                            You
                          </span>
                        ) : null}
                        {!account.isActive ? (
                          <span className="ml-2 rounded-full bg-[var(--admin-bg)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[var(--admin-muted)]">
                            Inactive
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[12px] text-[var(--admin-muted)]">{account.email}</p>
                      {account.businessName ? (
                        <p className="text-[12px] text-[var(--admin-muted)]">
                          {account.clientId ? (
                            <Link to={`/admin/clients/${account.clientId}`} className="text-[var(--admin-blue)] hover:underline">
                              {account.businessName}
                            </Link>
                          ) : (
                            account.businessName
                          )}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-ink)]">{accountRoleLabel(account)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-muted)]">{formatClientDate(account.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-muted)]">
                      {account.lastSignInAt ? formatClientDate(account.lastSignInAt) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {account.role !== "client" ? (
                        <span className="text-[var(--admin-muted)]">—</span>
                      ) : sites.length === 0 ? (
                        <span className="text-[12px] text-[var(--admin-muted)]">No launched website</span>
                      ) : (
                        <ul className="space-y-1.5">
                          {sites.map((site) => {
                            const paused = Boolean(site.development.pausedAt);
                            return (
                              <li key={site.id} className="flex flex-wrap items-center gap-2">
                                <Link to={`/admin/projects/${site.id}`} className="font-medium text-[var(--admin-blue)] hover:underline">
                                  {site.name}
                                </Link>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 font-heading text-[11px] font-semibold",
                                    paused ? "bg-amber-100 text-amber-800" : "bg-[rgb(16_185_129_/_0.1)] text-[#0f7a56]",
                                  )}
                                >
                                  {paused ? "Paused" : "Live"}
                                </span>
                                {!paused ? (
                                  <button
                                    type="button"
                                    onClick={() => setTakeDown(site)}
                                    className="inline-flex items-center gap-1 font-heading text-[12px] font-semibold text-[#b42318] hover:underline"
                                  >
                                    <PowerOff size={12} strokeWidth={2.4} aria-hidden="true" />
                                    Take down
                                  </button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {account.isSelf ? (
                        <span className="text-[12px] text-[var(--admin-muted)]">Your account</span>
                      ) : (
                        <div className="flex flex-col items-end gap-1.5">
                          <button type="button" className={`${adminDangerBtn} h-9 gap-1.5 px-3 text-[12px]`} onClick={() => openDelete(account)}>
                            <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                            Delete account
                          </button>
                          {account.clientId ? (
                            <Link
                              to={`/admin/clients/${account.clientId}#overview`}
                              className="font-heading text-[12px] font-semibold text-[#b42318] hover:underline"
                            >
                              Delete client &amp; everything…
                            </Link>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deletions.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Recently deleted accounts</h2>
          <ul className="mt-3 divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
            {deletions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-[var(--admin-ink)]">{item.fullName || item.email}</span>
                  <span className="ml-2 text-[12px] text-[var(--admin-muted)]">
                    {item.email}
                    {item.businessName ? ` · ${item.businessName}` : ""}
                  </span>
                </span>
                <span className="text-[12px] text-[var(--admin-muted)]">
                  {formatClientDate(item.createdAt)}
                  {item.deletedByEmail ? ` by ${item.deletedByEmail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDocumentModal
        open={Boolean(deleting)}
        danger
        busy={busy}
        title="Delete this account?"
        description={
          deleting ? (
            <span className="block space-y-2">
              <span className="block">
                <strong>{deleting.fullName || deleting.email}</strong> ({deleting.email}) will no longer be able to sign in, and their sessions,
                notifications and settings are removed. This can&rsquo;t be undone.
              </span>
              <span className="block">
                It does <strong>not</strong> delete the client&rsquo;s business record, projects or files, and it does not take their website
                offline. Use <em>Take down</em> for that.
              </span>
              {deleting.hasActivePlan ? (
                <span className="block font-medium text-[#b42318]">
                  This client still has an active Website Care plan. Cancel the plan first; the account can&rsquo;t be deleted until then.
                </span>
              ) : null}
            </span>
          ) : null
        }
        actionLabel="Delete account"
        confirmDisabled={!emailMatches || Boolean(deleting?.hasActivePlan)}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        onConfirm={() => void confirmDelete()}
        extra={
          deleting ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Type <span className="font-mono text-[13px]">{deleting.email}</span> to confirm
                <input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                />
              </label>
              {deleteError ? (
                <p role="alert" className="text-sm text-[#b42318]">
                  {deleteError}
                </p>
              ) : null}
            </div>
          ) : null
        }
      />

      {takeDown ? <PauseWebsiteDialog project={takeDown} open takeDown onClose={() => setTakeDown(null)} /> : null}
    </div>
  );
}
