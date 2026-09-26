import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ShieldAlert, Trash2, UserRound, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { adminFilterControlState, adminStatusChipClass } from "@/components/admin/list/adminListStyles";
import { PauseWebsiteDialog } from "@/components/admin/projects/PauseWebsiteDialog";
import { ConfirmDocumentModal } from "@/components/documents/ConfirmDocumentModal";
import { accountRoleLabel, type AccountDeletion, type AccountRow } from "@/data/accounts";
import { deleteAccount, listAccountDeletions, listAccounts } from "@/data/accountsRepository";
import type { AgencyProject } from "@/data/agencyProjects";
import { formatClientDate } from "@/data/agencyClients";
import { initialsFromName } from "@/auth/userDisplay";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type RoleFilter = "all" | "client" | "team";

/** "today", "yesterday", "3 days ago" or "on September 16, 2026", to read after a verb. */
function whenText(iso: string): string {
  const text = formatClientDate(iso);
  return /^(Today|Yesterday|[0-9]+ days ago)$/.test(text) ? text.toLowerCase() : `on ${text}`;
}

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

  const clientRows = visible.filter((account) => account.role === "client");
  const teamRows = visible.filter((account) => account.role !== "client");
  const groups = [
    { key: "clients", title: "Clients", icon: Users, rows: clientRows },
    { key: "team", title: "Team", icon: ShieldAlert, rows: teamRows },
  ].filter((group) => group.rows.length > 0);
  const totalClients = accounts.filter((account) => account.role === "client").length;
  const liveSites = useMemo(
    () =>
      projects.filter((project) => !project.archived && project.development.deploymentStatus === "Production" && !project.development.pausedAt).length,
    [projects],
  );

  function menuItems(account: AccountRow): AdminActionsMenuItem[] {
    const items: AdminActionsMenuItem[] = [
      { id: "delete-account", label: "Delete account", icon: Trash2, danger: true, onSelect: () => openDelete(account) },
    ];
    if (account.clientId) {
      items.push({
        id: "delete-client",
        label: "Delete client & everything…",
        icon: Building2,
        danger: true,
        href: `/admin/clients/${account.clientId}#overview`,
        separatorBefore: true,
      });
    }
    return items;
  }

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

      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "Accounts", value: accounts.length },
          { label: "Clients", value: totalClients },
          { label: "Team", value: accounts.length - totalClients },
          { label: "Live websites", value: liveSites },
        ].map((tile) => (
          <div key={tile.label} className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3">
            <p className="font-heading text-2xl font-semibold leading-tight text-[var(--admin-ink)]">{loading ? "–" : tile.value}</p>
            <p className="text-[12px] text-[var(--admin-muted)]">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
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
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.key} className="overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
              <div className="flex items-center gap-2.5 border-b border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
                  <group.icon size={15} strokeWidth={2} aria-hidden="true" />
                </span>
                <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{group.title}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 font-heading text-[11px] font-semibold text-[var(--admin-muted)] ring-1 ring-[var(--admin-line)]">
                  {group.rows.length}
                </span>
              </div>
              <ul className="divide-y divide-[var(--admin-line)]">
                {group.rows.map((account) => {
                  const sites = sitesFor(account);
                  return (
                    <li key={account.userId} className="relative grid gap-x-4 gap-y-3 px-4 py-3.5 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,2fr)_auto] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3 pr-11 lg:pr-0">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-full font-heading text-[13px] font-semibold",
                            account.role === "client" ? "bg-[rgb(0_80_240_/_0.1)] text-[var(--admin-blue)]" : "bg-[var(--admin-navy)] text-white",
                          )}
                        >
                          {initialsFromName(account.fullName || account.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-sm font-semibold text-[var(--admin-ink)]">
                            <span className="truncate">{account.fullName || account.email}</span>
                            {account.isSelf ? (
                              <span className="rounded-full bg-[rgb(0_80_240_/_0.08)] px-2 py-0.5 text-[11px] font-semibold text-[var(--admin-blue)]">You</span>
                            ) : null}
                            {!account.isActive ? (
                              <span className="rounded-full bg-[var(--admin-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--admin-muted)]">Inactive</span>
                            ) : null}
                          </p>
                          <p className="truncate text-[12px] text-[var(--admin-muted)]">{account.email}</p>
                          {account.businessName ? (
                            <p className="truncate text-[12px]">
                              {account.clientId ? (
                                <Link to={`/admin/clients/${account.clientId}`} className="font-medium text-[var(--admin-blue)] hover:underline">
                                  {account.businessName}
                                </Link>
                              ) : (
                                <span className="text-[var(--admin-muted)]">{account.businessName}</span>
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 font-heading text-[12px] font-semibold",
                            account.role === "admin"
                              ? "bg-[var(--admin-navy)] text-white"
                              : account.role === "client"
                                ? "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]"
                                : "bg-[var(--admin-bg)] text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)]",
                          )}
                        >
                          {accountRoleLabel(account)}
                        </span>
                        <p className="mt-1.5 text-[12px] text-[var(--admin-muted)]">
                          {account.lastSignInAt ? (
                            <>
                              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500 align-middle" aria-hidden="true" />
                              Signed in {whenText(account.lastSignInAt)}
                            </>
                          ) : (
                            <>
                              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-400 align-middle" aria-hidden="true" />
                              Never signed in
                            </>
                          )}
                        </p>
                        <p className="text-[12px] text-[var(--admin-muted)]">Joined {whenText(account.createdAt)}</p>
                      </div>

                      <div className="min-w-0">
                        {account.role !== "client" ? null : sites.length === 0 ? (
                          <span className="text-[12px] text-[var(--admin-muted)]">No launched website</span>
                        ) : (
                          <ul className="space-y-1.5">
                            {sites.map((site) => {
                              const paused = Boolean(site.development.pausedAt);
                              return (
                                <li key={site.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--admin-line)] px-2.5 py-1.5">
                                  <span
                                    aria-hidden="true"
                                    className={cn("size-2 shrink-0 rounded-full", paused ? "bg-amber-400" : "bg-emerald-500")}
                                  />
                                  <Link to={`/admin/projects/${site.id}`} className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--admin-ink)] hover:text-[var(--admin-blue)]">
                                    {site.name}
                                  </Link>
                                  <span className="text-[11px] font-semibold text-[var(--admin-muted)]">{paused ? "Paused" : "Live"}</span>
                                  {!paused ? (
                                    <button
                                      type="button"
                                      onClick={() => setTakeDown(site)}
                                      className="rounded-md border border-[rgb(180_35_24_/_0.28)] bg-[rgb(220_38_38_/_0.06)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#b42318] hover:bg-[rgb(220_38_38_/_0.12)]"
                                    >
                                      Take down
                                    </button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div className="absolute right-3 top-3 lg:static lg:flex lg:w-10 lg:justify-end">
                        {account.isSelf ? null : (
                          <AdminActionsMenu ariaLabel={`Actions for ${account.fullName || account.email}`} iconOnly items={menuItems(account)} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {deletions.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Recently deleted accounts</h2>
          <ul className="mt-3 divide-y divide-[var(--admin-line)] rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]">
            {deletions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-bg)] text-[var(--admin-muted)]">
                    <UserRound size={15} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--admin-ink)]">{item.fullName || item.email}</p>
                    <p className="truncate text-[12px] text-[var(--admin-muted)]">
                      {item.email}
                      {item.businessName ? ` · ${item.businessName}` : ""}
                    </p>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--admin-muted)]">
                  Deleted {whenText(item.createdAt)}
                  {item.deletedByEmail ? ` by ${item.deletedByEmail}` : ""}
                </p>
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
