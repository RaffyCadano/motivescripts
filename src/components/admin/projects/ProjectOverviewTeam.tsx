import { useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canCoordinateAssignedWork, hasPermission } from "@/auth/permissions";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { PROJECT_TEAM_SLOTS, projectTeamSlots } from "@/data/projectWorkspace";
import {
  clientProjectManagerCandidates,
  projectTeamCandidates,
  type TeamMember,
} from "@/data/team";
import { assignStaffToClient, assignStaffToProject, unassignStaffFromClient, unassignStaffFromProject } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function ProjectOverviewTeam({
  members,
  projectId,
  clientId,
  assignedLabels,
  onChanged,
}: {
  members: TeamMember[];
  projectId: string;
  clientId?: string;
  assignedLabels: Record<string, string>;
  onChanged: () => void;
}) {
  const { profile } = useAuth();
  const slots = projectTeamSlots(members, projectId, assignedLabels);
  const pmSlot = slots.find((slot) => slot.id === "project_manager");
  const productionSlots = slots.filter((slot) => slot.id !== "project_manager");
  const assignedOnProject = members.filter((member) =>
    member.projectAssignments.some((item) => item.entityId === projectId),
  );

  function memberForSlot(slotId: string): TeamMember | undefined {
    const templates: readonly string[] =
      PROJECT_TEAM_SLOTS.find((slot) => slot.id === slotId)?.templates ?? [];
    return assignedOnProject.find((member) => templates.includes(member.templateKey));
  }
  const pmAssigned = members.filter(
    (member) =>
      member.templateKey === "project_manager" &&
      member.clientAssignments.some((item) => item.entityId === clientId),
  );
  const canManageClient = hasPermission(profile, "clients.manage");
  const canManageProject = canCoordinateAssignedWork(profile);
  const [pmPickerOpen, setPmPickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [pmUserId, setPmUserId] = useState("");
  const [projectUserId, setProjectUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pmCandidates = useMemo(
    () => clientProjectManagerCandidates(members, pmAssigned.map((member) => member.id)),
    [members, pmAssigned],
  );
  const projectAssignedIds = members
    .filter((member) => member.projectAssignments.some((item) => item.entityId === projectId))
    .map((member) => member.id);
  const projectCandidates = useMemo(
    () => projectTeamCandidates(members, projectAssignedIds, clientId),
    [clientId, members, projectAssignedIds],
  );

  async function assignPm() {
    if (!clientId || !pmUserId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await assignStaffToClient(clientId, pmUserId);
      setPmUserId("");
      setPmPickerOpen(false);
      onChanged();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to assign the project manager.");
    } finally {
      setBusy(false);
    }
  }

  async function assignProduction() {
    if (!projectUserId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await assignStaffToProject(projectId, projectUserId);
      setProjectUserId("");
      setProjectPickerOpen(false);
      onChanged();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to assign this team member.");
    } finally {
      setBusy(false);
    }
  }

  async function removePm(userId: string) {
    if (!clientId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unassignStaffFromClient(clientId, userId);
      onChanged();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove the project manager.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduction(userId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await unassignStaffFromProject(projectId, userId);
      onChanged();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to remove this team member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Team</h2>
        {canManageProject ? (
          <button type="button" className={adminGhostBtn} onClick={() => setProjectPickerOpen((open) => !open)}>
            {projectPickerOpen ? "Cancel" : "Assign"}
          </button>
        ) : null}
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <TeamRow
          label="Project Manager"
          names={pmSlot?.names.length ? pmSlot.names : pmAssigned.map((member) => member.fullName || member.email)}
          canManage={canManageClient && Boolean(clientId)}
          onAssign={() => setPmPickerOpen((open) => !open)}
          onRemove={pmAssigned[0] ? () => void removePm(pmAssigned[0].id) : undefined}
        />
        {productionSlots.map((slot) => {
          const member = memberForSlot(slot.id);
          return (
            <TeamRow
              key={slot.id}
              label={slot.label}
              names={slot.names}
              canManage={canManageProject && Boolean(member)}
              onRemove={member ? () => void removeProduction(member.id) : undefined}
            />
          );
        })}
      </dl>

      {canManageClient && pmPickerOpen && clientId ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--admin-line)] pt-4 sm:flex-row sm:items-center">
          <select
            value={pmUserId}
            onChange={(event) => setPmUserId(event.target.value)}
            className="h-10 w-full min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
          >
            <option value="">{pmCandidates.length === 0 ? "No project managers available" : "Select project manager"}</option>
            {pmCandidates.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName || member.email}
              </option>
            ))}
          </select>
          <button type="button" disabled={!pmUserId || busy} className={`${adminPrimaryBtn} shrink-0 justify-center`} onClick={() => void assignPm()}>
            Assign PM
          </button>
        </div>
      ) : null}

      {canManageProject && projectPickerOpen ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--admin-line)] pt-4 sm:flex-row sm:items-center">
          <select
            value={projectUserId}
            onChange={(event) => setProjectUserId(event.target.value)}
            className="h-10 w-full min-w-0 flex-1 rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm"
          >
            <option value="">{projectCandidates.length === 0 ? "No team members available" : "Select team member"}</option>
            {projectCandidates.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName || member.email} — {member.templateLabel}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!projectUserId || busy}
            className={`${adminPrimaryBtn} shrink-0 justify-center`}
            onClick={() => void assignProduction()}
          >
            Assign
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
    </section>
  );
}

function TeamRow({
  label,
  names,
  canManage,
  onAssign,
  onRemove,
}: {
  label: string;
  names: string[];
  canManage: boolean;
  onAssign?: () => void;
  onRemove?: () => void;
}) {
  const display = names.length > 0 ? names.join(", ") : "Unassigned";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">{label}</dt>
        <dd className="mt-0.5 text-[var(--admin-ink)]">{display}</dd>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canManage && names.length === 0 && onAssign ? (
          <button type="button" className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline" onClick={onAssign}>
            Assign
          </button>
        ) : null}
        {canManage && names.length > 0 && onRemove ? (
          <button type="button" className="font-heading text-[12px] font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)]" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
