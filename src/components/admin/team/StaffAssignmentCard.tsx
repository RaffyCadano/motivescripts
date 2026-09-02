import { useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canCoordinateAssignedWork, hasPermission } from "@/auth/permissions";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { AgencyTask } from "@/data/agencyProjects";
import {
  clientProjectManagerCandidates,
  memberStaffRoleLabel,
  staffMemberPickerLabel,
  teamWorkloadCaption,
  type TeamMember,
} from "@/data/team";
import { assignStaffToClient, assignStaffToProject, unassignStaffFromClient, unassignStaffFromProject } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type AssignmentKind = "client" | "project";

type StaffAssignmentCardProps = {
  kind: AssignmentKind;
  entityId: string;
  entityClientId?: string;
  members: TeamMember[];
  assignedUserIds: string[];
  assignedLabels: Record<string, string>;
  projectTasks?: AgencyTask[];
  onChanged: () => void;
};

export function StaffAssignmentCard({
  kind,
  entityId,
  entityClientId,
  members,
  assignedUserIds,
  assignedLabels,
  projectTasks,
  onChanged,
}: StaffAssignmentCardProps) {
  const { profile } = useAuth();
  const canManage =
    kind === "project" ? canCoordinateAssignedWork(profile) : hasPermission(profile, "clients.manage");
  const [userId, setUserId] = useState("");
  const [label, setLabel] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigned = useMemo(
    () =>
      members
        .filter((member) => assignedUserIds.includes(member.id))
        .slice()
        .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email)),
    [assignedUserIds, members],
  );
  const eligible = useMemo(() => {
    if (kind === "client") return clientProjectManagerCandidates(members, assignedUserIds);
    return members
      .filter((member) => {
        if (!member.isActive) return false;
        if (assignedUserIds.includes(member.id)) return false;
        if (member.role === "admin") return true;
        if (entityClientId) {
          const clientIds = new Set(member.clientAssignments.map((item) => item.entityId));
          if (clientIds.size > 0 && !clientIds.has(entityClientId)) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
  }, [assignedUserIds, entityClientId, kind, members]);

  const showAssignForm = canManage && (kind === "project" || assigned.length === 0 || pickerOpen);

  async function assign() {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const member = members.find((item) => item.id === userId);
      if (kind === "client") await assignStaffToClient(entityId, userId);
      else {
        if (entityClientId && member?.role === "admin") {
          await assignStaffToClient(entityClientId, userId, label);
        }
        await assignStaffToProject(entityId, userId, label);
      }
      setUserId("");
      setLabel("");
      setPickerOpen(false);
      onChanged();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to assign this team member.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "client") await unassignStaffFromClient(entityId, id);
      else await unassignStaffFromProject(entityId, id);
      setPendingRemove(null);
      onChanged();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove this team member.");
    } finally {
      setBusy(false);
    }
  }

  if (kind === "client") {
    return (
      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
              Client Account Team
            </h2>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
              The project manager coordinates this client relationship. Production staff are assigned on each project.
            </p>
          </div>
          {canManage && assigned.length > 0 ? (
            <button
              type="button"
              className={pickerOpen ? adminGhostBtn : adminPrimaryBtn}
              onClick={() => {
                setPickerOpen((open) => !open);
                setError(null);
              }}
            >
              {pickerOpen ? "Cancel" : "+ Assign PM"}
            </button>
          ) : null}
        </div>

        {assigned.length === 0 ? (
          <div className="mt-4">
            <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No project manager assigned</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              Assign a PM to coordinate this client’s project.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                  <th className="py-2 pr-4 font-semibold">Team member</th>
                  <th className="py-2 pr-4 font-semibold">Role</th>
                  {canManage ? <th className="py-2 font-semibold">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {assigned.map((member) => (
                  <tr key={member.id} className="border-b border-[var(--admin-line)] last:border-b-0">
                    <td className="py-3 pr-4 font-heading text-sm font-semibold text-[var(--admin-ink)]">
                      {member.fullName || member.email}
                    </td>
                    <td className="py-3 pr-4 text-[var(--admin-muted)]">{memberStaffRoleLabel(member)}</td>
                    {canManage ? (
                      <td className="py-3">
                        <button
                          type="button"
                          disabled={busy}
                          className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-50"
                          onClick={() => {
                            setPendingRemove(member);
                            setError(null);
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAssignForm ? (
          <div className={assigned.length > 0 ? "mt-4 space-y-2 border-t border-[var(--admin-line)] pt-4" : "mt-4 space-y-2"}>
            {assigned.length > 0 ? (
              <h3 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
                Assign project manager
              </h3>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                id="assign-pm-select"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="h-10 w-full min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
              >
                <option value="">{eligible.length === 0 ? "No project managers available" : "Select a project manager"}</option>
                {eligible.map((member) => (
                  <option key={member.id} value={member.id}>
                    {staffMemberPickerLabel(member)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!userId || busy}
                className={`${adminPrimaryBtn} shrink-0 justify-center`}
                onClick={() => void assign()}
              >
                Assign PM
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}

        <ConfirmUnassignClientMemberDialog
          member={pendingRemove}
          busy={busy}
          onClose={() => {
            if (!busy) setPendingRemove(null);
          }}
          onConfirm={() => {
            if (pendingRemove) void remove(pendingRemove.id);
          }}
        />
      </section>
    );
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Assign staff</h2>
      {assigned.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--admin-muted)]">No team members assigned yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {assigned.map((member) => {
            const projectAssigned = (projectTasks ?? []).filter((task) => task.assignedTo === member.id);
            const openOnProject = projectAssigned.filter((task) => task.status !== "Completed").length;
            return (
              <li key={member.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--admin-ink)]">{member.fullName || member.email}</p>
                  <p className="text-[12px] text-[var(--admin-muted)]">
                    {[member.templateLabel, member.jobTitle && member.jobTitle !== member.templateLabel ? member.jobTitle : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {assignedLabels[member.id] ? (
                    <p className="text-[12px] text-[var(--admin-muted)]">{assignedLabels[member.id]}</p>
                  ) : null}
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                    {`${openOnProject} assigned task${openOnProject === 1 ? "" : "s"} · ${teamWorkloadCaption(member)}`}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                    onClick={() => void remove(member.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canManage ? (
        <div className="mt-4 space-y-2 border-t border-[var(--admin-line)] pt-4">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Assign team member</h2>
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
          >
            <option value="">Select a team member</option>
            {eligible.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName || member.email}
              </option>
            ))}
          </select>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Role on this record (optional)"
            className="h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
          />
          <button
            type="button"
            disabled={!userId || busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void assign()}
          >
            Assign
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[var(--admin-muted)]">{error}</p> : null}
    </section>
  );
}

function ConfirmUnassignClientMemberDialog({
  member,
  busy,
  onClose,
  onConfirm,
}: {
  member: TeamMember | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AdminDialog
      open={Boolean(member)}
      title="Remove this team member?"
      description={
        member
          ? `${member.fullName || member.email} will no longer be assigned to this client.`
          : undefined
      }
      busy={busy}
      onClose={onClose}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          onClick={onConfirm}
        >
          {busy ? "Removing…" : "Remove"}
        </button>
      </div>
    </AdminDialog>
  );
}
