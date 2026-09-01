import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { AdminStatCard, AdminStatGrid } from "@/components/admin/list/AdminStatCard";
import { AdminStatusChips } from "@/components/admin/list/AdminStatusChips";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import { TeamStatusBadge } from "@/components/admin/team/TeamStatusBadge";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import {
  formatTeamDate,
  teamAssignedProjectNames,
  teamRoleSubtitle,
  teamRowEmail,
  teamRowHref,
  teamRowName,
  teamRowRole,
  teamRowTitle,
  teamWorkloadCaption,
  type TeamInvitation,
  type TeamListRow,
  type TeamMember,
} from "@/data/team";
import { revokeStaffInvitation, sendStaffInvitation } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type RoleFilter = "All" | string;
type StatusFilter = "All" | "active" | "inactive" | "pending";

const statusFilters: StatusFilter[] = ["All", "active", "inactive", "pending"];

function matchesQuery(row: TeamListRow, needle: string) {
  if (!needle) return true;
  return `${teamRowName(row)} ${teamRowEmail(row)} ${teamRowTitle(row)}`.toLowerCase().includes(needle);
}

function matchesRole(row: TeamListRow, role: RoleFilter) {
  if (role === "All") return true;
  const key = row.kind === "member" ? row.member.templateKey : row.invitation.templateKey;
  return key === role;
}

export function AdminTeam() {
  const { profile } = useAuth();
  const { data, status, error, reload } = useTeamDirectory();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const canInvite = isActiveAdmin(profile);
  const canView = hasPermission(profile, "team.view");

  const members = data?.members ?? [];
  const pendingInvites = (data?.invitations ?? []).filter((item) => item.status === "pending");
  const activeCount = members.filter((item) => item.isActive).length;
  const inactiveCount = members.filter((item) => !item.isActive).length;

  type MemberRow = Extract<TeamListRow, { kind: "member" }>;
  type InviteRow = Extract<TeamListRow, { kind: "invite" }>;

  const memberRows = useMemo<MemberRow[]>(
    () => members.map((member) => ({ kind: "member" as const, member })),
    [members],
  );
  const inviteRows = useMemo<InviteRow[]>(
    () => pendingInvites.map((invitation) => ({ kind: "invite" as const, invitation })),
    [pendingInvites],
  );

  const visibleMembers = useMemo(() => {
    if (statusFilter === "pending") return [];
    const needle = query.trim().toLowerCase();
    return memberRows.filter((row) => {
      if (!matchesQuery(row, needle) || !matchesRole(row, role)) return false;
      if (statusFilter === "active") return row.member.isActive;
      if (statusFilter === "inactive") return !row.member.isActive;
      return true;
    });
  }, [memberRows, query, role, statusFilter]);

  const visibleInvites = useMemo(() => {
    if (statusFilter === "active" || statusFilter === "inactive") return [];
    const needle = query.trim().toLowerCase();
    return inviteRows.filter((row) => matchesQuery(row, needle) && matchesRole(row, role));
  }, [inviteRows, query, role, statusFilter]);

  const filtering = query.trim().length > 0 || role !== "All" || statusFilter !== "All";
  const emptyWorkspace = members.length === 0 && pendingInvites.length === 0;
  const onePerson = members.length === 1 && activeCount === 1 && pendingInvites.length === 0;

  function clearFilters() {
    setQuery("");
    setRole("All");
    setStatusFilter("All");
  }

  function selectStatus(next: StatusFilter) {
    setStatusFilter(statusFilter === next && next !== "All" ? "All" : next);
  }

  async function resendInvite(invitation: TeamInvitation) {
    if (busyId) return;
    setBusyId(invitation.id);
    setInviteMessage(null);
    try {
      await sendStaffInvitation({
        email: invitation.email,
        fullName: invitation.inviteeName,
        jobTitle: invitation.jobTitle,
        templateKey: invitation.templateKey,
        permissionCodes: invitation.permissionCodes,
        action: "resend",
      });
      await reload();
      setInviteMessage(`Invitation resent to ${invitation.email}.`);
    } catch (caught) {
      setInviteMessage(caught instanceof AgencyDbError ? caught.message : "Unable to send this invitation.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelInvite(invitation: TeamInvitation) {
    if (busyId) return;
    setBusyId(invitation.id);
    setInviteMessage(null);
    try {
      await revokeStaffInvitation(invitation.id);
      await reload();
      setInviteMessage("Invitation cancelled.");
    } catch (caught) {
      setInviteMessage(caught instanceof AgencyDbError ? caught.message : "This invitation can no longer be changed.");
    } finally {
      setBusyId(null);
    }
  }

  if (!canView) {
    return (
      <div className="space-y-5">
        <AdminPageHeader title="Team" description="Invite staff, assign roles, and control workspace access." />
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to perform this action.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Team"
        description="Invite staff, assign roles, and control workspace access."
        action={
          canInvite ? (
            <Link to="/admin/team/new" className={`${adminBlueBtn} justify-center`}>
              Invite Team Member
            </Link>
          ) : undefined
        }
      />

      <section aria-label="Team snapshot">
        <AdminStatGrid columns={4}>
          <AdminStatCard
            label="Total team members"
            value={members.length}
            active={statusFilter === "All"}
            onClick={() => {
              setStatusFilter("All");
              setRole("All");
              setQuery("");
            }}
          />
          <AdminStatCard
            label="Active"
            value={activeCount}
            active={statusFilter === "active"}
            onClick={() => selectStatus("active")}
          />
          <AdminStatCard
            label="Inactive"
            value={inactiveCount}
            active={statusFilter === "inactive"}
            onClick={() => selectStatus("inactive")}
          />
          <AdminStatCard
            label="Pending invitations"
            value={pendingInvites.length}
            active={statusFilter === "pending"}
            onClick={() => selectStatus("pending")}
          />
        </AdminStatGrid>
        {onePerson ? (
          <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
            1 active team member. Assign projects when work is ready — you don’t need more staff until you do.
          </p>
        ) : null}
      </section>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search team</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, or job title"
              className={adminFilterControlState(Boolean(query.trim()))}
            />
          </label>
          <label className="lg:w-56">
            <span className="sr-only">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as RoleFilter)}
              className={adminFilterControlState(role !== "All")}
            >
              <option value="All">All roles</option>
              {(data?.catalog.templates ?? []).map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {filtering ? (
            <button type="button" className={`${adminGhostBtn} shrink-0 justify-center`} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        <AdminStatusChips
          items={statusFilters}
          value={statusFilter}
          onChange={setStatusFilter}
          label="Team status"
          format={(item) =>
            item === "All" ? "All" : item === "pending" ? "Pending invitations" : item === "active" ? "Active" : "Inactive"
          }
        />
      </div>

      {status === "error" ? (
        <AdminEmptyState title="Unable to load the team." body={error || "Try again in a moment."} />
      ) : status === "loading" && !data ? (
        <div className="h-36 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />
      ) : emptyWorkspace ? (
        <AdminEmptyState
          title="No team members yet"
          body="Invite your first team member to start assigning projects and managing agency work."
          action={
            canInvite ? (
              <Link to="/admin/team/new" className={`${adminBlueBtn} justify-center`}>
                Invite Team Member
              </Link>
            ) : undefined
          }
        />
      ) : visibleMembers.length === 0 && visibleInvites.length === 0 ? (
        <AdminEmptyState
          title="No team members match your filters."
          body="Try a different name, email, role, or status."
          action={
            filtering ? (
              <button type="button" className={`${adminGhostBtn} justify-center`} onClick={clearFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {statusFilter !== "pending" ? (
            <MemberList
              rows={visibleMembers}
              empty={
                members.length === 0 && pendingInvites.length > 0
                  ? "No active team members yet. Pending invitations are not part of the team until they are accepted."
                  : visibleMembers.length === 0
                    ? "No team members match this status."
                    : null
              }
            />
          ) : null}

          {visibleInvites.length > 0 ? (
            <PendingInviteList
              rows={visibleInvites}
              canManage={canInvite}
              busyId={busyId}
              message={inviteMessage}
              onResend={resendInvite}
              onCancel={cancelInvite}
            />
          ) : null}
        </>
      )}

      <p className="text-[12px] leading-relaxed text-[var(--admin-muted)]">
        Role, permissions, and project assignments determine what each person can access. Open a teammate to review
        profile, permissions, assigned clients, and workload.
      </p>
    </div>
  );
}

function MemberList({ rows, empty }: { rows: Extract<TeamListRow, { kind: "member" }>[]; empty: string | null }) {
  if (rows.length === 0) {
    return empty ? (
      <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-6">
        <p className="text-sm text-[var(--admin-muted)]">{empty}</p>
      </div>
    ) : null;
  }

  return (
    <section>
      <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">Team members</h2>
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[56rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Team member</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Workload</th>
              <th className="px-5 py-3 font-semibold">Last activity</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const member = row.member;
              const projects = teamAssignedProjectNames(member);
              return (
                <tr key={member.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5">
                    <Link
                      to={teamRowHref(row)}
                      className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    >
                      {teamRowName(row)}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{teamRowEmail(row)}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-heading text-[13px] font-semibold text-[var(--admin-ink)]">{teamRowRole(row)}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{teamRoleSubtitle(row)}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <TeamStatusBadge row={row} />
                  </td>
                  <td className="px-5 py-3.5">
                    <p
                      className={cn(
                        "font-heading text-[13px] font-semibold",
                        member.projectAssignments.length > 0 || member.activeTaskCount > 0
                          ? "text-[var(--admin-ink)]"
                          : "text-[var(--admin-muted)]",
                      )}
                    >
                      {teamWorkloadCaption(member)}
                    </p>
                    {projects ? <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{projects}</p> : null}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatTeamDate(member.lastActiveAt)}</td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={teamRowHref(row)}
                      className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <MemberCard key={row.member.id} member={row.member} row={row} />
        ))}
      </ul>
    </section>
  );
}

function MemberCard({ member, row }: { member: TeamMember; row: TeamListRow }) {
  const projects = teamAssignedProjectNames(member);
  return (
    <li className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to={teamRowHref(row)}
            className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
          >
            {teamRowName(row)}
          </Link>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{teamRowEmail(row)}</p>
        </div>
        <TeamStatusBadge row={row} />
      </div>
      <p className="mt-3 font-heading text-sm font-semibold text-[var(--admin-ink)]">{teamRowRole(row)}</p>
      <p className="text-[12px] text-[var(--admin-muted)]">{teamRoleSubtitle(row)}</p>
      <p
        className={cn(
          "mt-2 font-heading text-[13px] font-semibold",
          member.projectAssignments.length > 0 || member.activeTaskCount > 0
            ? "text-[var(--admin-ink)]"
            : "text-[var(--admin-muted)]",
        )}
      >
        {teamWorkloadCaption(member)}
      </p>
      {projects ? <p className="text-[12px] text-[var(--admin-muted)]">{projects}</p> : null}
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Last activity {formatTeamDate(member.lastActiveAt)}</p>
      <Link
        to={teamRowHref(row)}
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
      >
        View
      </Link>
    </li>
  );
}

function PendingInviteList({
  rows,
  canManage,
  busyId,
  message,
  onResend,
  onCancel,
}: {
  rows: Extract<TeamListRow, { kind: "invite" }>[];
  canManage: boolean;
  busyId: string | null;
  message: string | null;
  onResend: (invitation: TeamInvitation) => void;
  onCancel: (invitation: TeamInvitation) => void;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Pending invitations</h2>
        <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
          These people have not joined yet. A pending invitation is not an active team member.
        </p>
      </div>
      {message ? <p className="mb-3 text-sm text-[var(--admin-muted)]">{message}</p> : null}
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[rgb(245_158_11_/_0.28)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[44rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Invitee</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Expires</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const invitation = row.invitation;
              const busy = busyId === invitation.id;
              return (
                <tr key={invitation.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5">
                    <Link
                      to={teamRowHref(row)}
                      className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    >
                      {teamRowName(row)}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{teamRowEmail(row)}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-heading text-[13px] font-semibold text-[var(--admin-ink)]">{teamRowRole(row)}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{teamRoleSubtitle(row)}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <TeamStatusBadge row={row} />
                  </td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatTeamDate(invitation.expiresAt)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        to={teamRowHref(row)}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                      >
                        View
                      </Link>
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline disabled:opacity-60"
                            onClick={() => onResend(invitation)}
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="font-heading text-[12px] font-semibold text-[var(--admin-muted)] hover:underline disabled:opacity-60"
                            onClick={() => onCancel(invitation)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => {
          const invitation = row.invitation;
          const busy = busyId === invitation.id;
          return (
            <li
              key={invitation.id}
              className="rounded-[var(--admin-radius)] border border-[rgb(245_158_11_/_0.28)] bg-[var(--admin-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={teamRowHref(row)}
                    className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                  >
                    {teamRowName(row)}
                  </Link>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{teamRowEmail(row)}</p>
                </div>
                <TeamStatusBadge row={row} />
              </div>
              <p className="mt-3 font-heading text-sm font-semibold">{teamRowRole(row)}</p>
              <p className="text-[12px] text-[var(--admin-muted)]">{teamRoleSubtitle(row)}</p>
              <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Expires {formatTeamDate(invitation.expiresAt)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={teamRowHref(row)}
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
                >
                  View
                </Link>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      className={`${adminGhostBtn} h-9 px-3 text-[12px]`}
                      onClick={() => onResend(invitation)}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className={`${adminGhostBtn} h-9 px-3 text-[12px]`}
                      onClick={() => onCancel(invitation)}
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
