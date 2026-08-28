import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import { InviteTeamDialog } from "@/components/admin/team/InviteTeamDialog";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import {
  formatTeamDate,
  teamRowEmail,
  teamRowName,
  teamRowRole,
  teamRowTitle,
  teamStatusLabel,
  type TeamListRow,
} from "@/data/team";

type RoleFilter = "All" | "admin" | "staff" | "project_manager" | "sales" | "accounting";
type StatusFilter = "All" | "active" | "inactive" | "pending";

export function AdminTeam() {
  const { profile } = useAuth();
  const { data, status, error, reload } = useTeamDirectory();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [inviteOpen, setInviteOpen] = useState(false);
  const canInvite = isActiveAdmin(profile);
  const canView = hasPermission(profile, "team.view");

  const rows = useMemo<TeamListRow[]>(() => {
    if (!data) return [];
    const pending = data.invitations
      .filter((item) => item.status === "pending")
      .map((invitation) => ({ kind: "invite" as const, invitation }));
    const members = data.members.map((member) => ({ kind: "member" as const, member }));
    return [...pending, ...members];
  }, [data]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle) {
        const hay = `${teamRowName(row)} ${teamRowEmail(row)} ${teamRowTitle(row)}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (role !== "All") {
        const key = row.kind === "member" ? row.member.templateKey : row.invitation.templateKey;
        if (key !== role) return false;
      }
      if (statusFilter === "pending") return row.kind === "invite";
      if (statusFilter === "active") return row.kind === "member" && row.member.isActive;
      if (statusFilter === "inactive") return row.kind === "member" && !row.member.isActive;
      return true;
    });
  }, [query, role, rows, statusFilter]);

  if (!canView) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Team</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">You don’t have permission to perform this action.</p>
      </div>
    );
  }

  const members = data?.members ?? [];
  const pending = (data?.invitations ?? []).filter((item) => item.status === "pending");
  const summary = [
    { id: "total", label: "Total team members", value: members.length },
    { id: "active", label: "Active", value: members.filter((item) => item.isActive).length },
    { id: "inactive", label: "Inactive", value: members.filter((item) => !item.isActive).length },
    { id: "pending", label: "Pending invitations", value: pending.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Team</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Invite staff, assign roles, and control workspace access.</p>
        </div>
        {canInvite ? (
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
            onClick={() => setInviteOpen(true)}
          >
            Invite Team Member
          </button>
        ) : null}
      </div>

      <section aria-label="Team snapshot">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summary.map((item) => (
            <article
              key={item.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-3"
            >
              <p className="text-[12px] text-[var(--admin-muted)]">{item.label}</p>
              <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--admin-ink)]">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or email"
          className="h-10 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as RoleFilter)}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="project_manager">Project Manager</option>
          <option value="sales">Sales</option>
          <option value="accounting">Accounting</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="h-10 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
        >
          <option value="All">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending invitations</option>
        </select>
      </div>

      {status === "error" ? (
        <p className="text-sm text-[var(--admin-muted)]">{error}</p>
      ) : status === "loading" && !data ? (
        <p className="text-sm text-[var(--admin-muted)]">Loading team…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No team members yet.</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Invite your first teammate from this page.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No team members match.</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Invite a teammate or adjust your filters.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
            <table className="w-full min-w-[56rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Job title</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Assigned projects</th>
                  <th className="px-5 py-3 font-semibold">Last activity</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.kind === "member" ? row.member.id : row.invitation.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                    <td className="px-5 py-3.5 font-medium text-[var(--admin-ink)]">{teamRowName(row)}</td>
                    <td className="px-5 py-3.5">{teamRowEmail(row)}</td>
                    <td className="px-5 py-3.5">{teamRowRole(row)}</td>
                    <td className="px-5 py-3.5">{teamRowTitle(row) || "—"}</td>
                    <td className="px-5 py-3.5">{teamStatusLabel(row)}</td>
                    <td className="px-5 py-3.5">
                      {row.kind === "member"
                        ? row.member.projectAssignments.length
                          ? row.member.projectAssignments.map((item) => item.entityName).join(", ")
                          : "—"
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--admin-muted)]">
                      {row.kind === "member" ? formatTeamDate(row.member.lastActiveAt) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        to={row.kind === "member" ? `/admin/team/${row.member.id}` : `/admin/team/invite/${row.invitation.id}`}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {visible.map((row) => (
              <li
                key={row.kind === "member" ? row.member.id : row.invitation.id}
                className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{teamRowName(row)}</p>
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{teamRowEmail(row)}</p>
                  </div>
                  <span className="text-[12px] font-medium text-[var(--admin-muted)]">{teamStatusLabel(row)}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--admin-ink)]">{teamRowRole(row)}</p>
                <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{teamRowTitle(row) || "No job title"}</p>
                <Link
                  to={row.kind === "member" ? `/admin/team/${row.member.id}` : `/admin/team/invite/${row.invitation.id}`}
                  className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {data ? (
        <InviteTeamDialog
          open={inviteOpen}
          templates={data.catalog.templates}
          permissions={data.catalog.permissions}
          onClose={() => setInviteOpen(false)}
          onSent={() => void reload()}
        />
      ) : null}
    </div>
  );
}
