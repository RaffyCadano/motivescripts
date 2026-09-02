import { useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canCoordinateAssignedWork, isActiveAdmin } from "@/auth/permissions";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { PRODUCTION_PROJECT_SLOT_IDS, projectTeamSlots } from "@/data/projectWorkspace";
import {
  assignedProjectMembers,
  memberRoleLabel,
  projectTeamCandidates,
  type TeamMember,
} from "@/data/team";
import { assignStaffToProject, unassignStaffFromProject } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type ProjectTeamRosterProps = {
  members: TeamMember[];
  projectId: string;
  clientId?: string;
  assignedLabels: Record<string, string>;
  onChanged?: () => void;
  onOpenTasks?: () => void;
};

export function ProjectTeamRoster({
  members,
  projectId,
  clientId,
  assignedLabels,
  onChanged,
  onOpenTasks,
}: ProjectTeamRosterProps) {
  const { profile } = useAuth();
  const assigned = assignedProjectMembers(members, projectId);
  const canManage = canManageProjectTeam(profile, members, projectId, clientId);
  const slots = projectTeamSlots(members, projectId, assignedLabels);
  const openSlots = slots.filter(
    (slot) =>
      slot.names.length === 0 &&
      (slot.id === "project_manager" || PRODUCTION_PROJECT_SLOT_IDS.has(slot.id)),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = useMemo(
    () => projectTeamCandidates(members, assigned.map((member) => member.id), clientId),
    [assigned, clientId, members],
  );

  async function assign(userId: string) {
    if (!canManage || busyId) return;
    setBusyId(userId);
    setError(null);
    try {
      await assignStaffToProject(projectId, userId);
      setPickerOpen(false);
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to assign this team member.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(userId: string) {
    if (!canManage || busyId) return;
    setBusyId(userId);
    setError(null);
    try {
      await unassignStaffFromProject(projectId, userId);
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove this team member.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Project Team</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            People assigned to this project. Task assignment on the Tasks tab is separate.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className={pickerOpen ? adminGhostBtn : adminPrimaryBtn}
            onClick={() => {
              setPickerOpen((open) => !open);
              setError(null);
            }}
          >
            {pickerOpen ? "Cancel" : "+ Assign Team Member"}
          </button>
        ) : null}
      </div>

      {assigned.length === 0 ? (
        <div className="mt-4">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No team members assigned yet.</p>
          <p className="mt-1 max-w-xl text-sm text-[var(--admin-muted)]">
            Assign a Project Manager, Developer, Designer, Content Writer, or Team Member to begin production.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
                <th className="py-2 pr-4 font-semibold">Team member</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                {canManage ? <th className="py-2 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {assigned.map((member) => (
                <tr key={member.id} className="border-b border-[var(--admin-line)] last:border-b-0">
                  <td className="py-3 pr-4 font-heading text-sm font-semibold text-[var(--admin-ink)]">
                    {member.fullName || member.email}
                  </td>
                  <td className="py-3 pr-4 text-[var(--admin-muted)]">
                    {memberRoleLabel(member, assignedLabels[member.id])}
                  </td>
                  {canManage ? (
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={Boolean(busyId)}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline disabled:opacity-50"
                        onClick={() => void remove(member.id)}
                      >
                        {busyId === member.id ? "Removing…" : "Remove"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {openSlots.length > 0 ? (
            <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
              Not assigned yet: {openSlots.map((slot) => slot.label).join(", ")}
            </p>
          ) : null}
        </div>
      )}

      {canManage && pickerOpen ? (
        <div className="mt-4 border-t border-[var(--admin-line)] pt-4">
          <h3 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Assign team member</h3>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            Project Manager and production staff. Sales and Accounting stay on their own work.
          </p>
          {eligible.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No production staff available to assign.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--admin-line)]">
              {eligible.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left disabled:opacity-50"
                    onClick={() => void assign(member.id)}
                  >
                    <span>
                      <span className="block font-heading text-sm font-semibold text-[var(--admin-ink)]">
                        {member.fullName || member.email}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[var(--admin-muted)]">
                        {member.templateLabel || "Team Member"}
                      </span>
                    </span>
                    <span className="font-heading text-[12px] font-semibold text-[var(--admin-blue)]">
                      {busyId === member.id ? "Assigning…" : "Assign"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {onOpenTasks && assigned.length > 0 ? (
        <p className="mt-4 text-[12px] text-[var(--admin-muted)]">
          Next,{" "}
          <button
            type="button"
            className="font-heading font-semibold text-[var(--admin-blue)] hover:underline"
            onClick={onOpenTasks}
          >
            assign their tasks
          </button>
          .
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
    </section>
  );
}

function canManageProjectTeam(
  profile: ReturnType<typeof useAuth>["profile"],
  members: TeamMember[],
  projectId: string,
  clientId?: string,
): boolean {
  if (!canCoordinateAssignedWork(profile) || !profile) return false;
  if (isActiveAdmin(profile)) return true;
  return members.some(
    (member) =>
      member.id === profile.id &&
      (member.projectAssignments.some((item) => item.entityId === projectId) ||
        Boolean(clientId && member.clientAssignments.some((item) => item.entityId === clientId))),
  );
}
