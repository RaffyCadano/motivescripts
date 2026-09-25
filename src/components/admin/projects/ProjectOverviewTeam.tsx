import { useMemo, useState } from "react";
import { Briefcase, Code, Palette, PenLine, Plus, ShieldCheck, UserPlus, UsersRound, X, type LucideIcon } from "lucide-react";
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
import { cn } from "@/lib/cn";

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
  const filledRoles =
    (pmSlot?.names.length || pmAssigned.length ? 1 : 0) + productionSlots.filter((slot) => slot.names.length > 0).length;
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
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)]">
            <UsersRound size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Team</h2>
            <p className="text-[12px] text-[var(--admin-muted)]">
              {filledRoles} of {slots.length} roles filled
            </p>
          </div>
        </div>
        {canManageProject ? (
          <button type="button" className={`${adminGhostBtn} gap-1.5`} onClick={() => setProjectPickerOpen((open) => !open)}>
            {projectPickerOpen ? (
              "Cancel"
            ) : (
              <>
                <UserPlus size={14} strokeWidth={2.2} aria-hidden="true" />
                Assign
              </>
            )}
          </button>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TeamRole
          slotId="project_manager"
          label="Project Manager"
          names={pmSlot?.names.length ? pmSlot.names : pmAssigned.map((member) => member.fullName || member.email)}
          canManage={canManageClient && Boolean(clientId)}
          onAssign={() => setPmPickerOpen((open) => !open)}
          onRemove={pmAssigned[0] ? () => void removePm(pmAssigned[0].id) : undefined}
          busy={busy}
        />
        {productionSlots.map((slot) => {
          const member = memberForSlot(slot.id);
          return (
            <TeamRole
              key={slot.id}
              slotId={slot.id}
              label={slot.label}
              names={slot.names}
              canManage={canManageProject && Boolean(member)}
              onRemove={member ? () => void removeProduction(member.id) : undefined}
              busy={busy}
            />
          );
        })}
      </ul>

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

const ROLE_ICONS: Record<string, LucideIcon> = {
  project_manager: Briefcase,
  developer: Code,
  designer: Palette,
  content_writer: PenLine,
  team_member: ShieldCheck,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

/** One role on the project: who holds it (avatar and name, with a remove button) or a dashed "Unassigned" tile. */
function TeamRole({
  slotId,
  label,
  names,
  canManage,
  onAssign,
  onRemove,
  busy,
}: {
  slotId: string;
  label: string;
  names: string[];
  canManage: boolean;
  onAssign?: () => void;
  onRemove?: () => void;
  busy: boolean;
}) {
  const Icon = ROLE_ICONS[slotId] ?? UsersRound;
  const filled = names.length > 0;
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-lg border p-3.5",
        filled ? "border-[var(--admin-line)] bg-[var(--admin-card)]" : "border-dashed border-[var(--admin-line)] bg-[var(--admin-bg)]",
      )}
    >
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--admin-muted)]">
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
        {label}
      </p>
      {filled ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgb(0_80_240_/_0.1)] font-heading text-[12px] font-semibold text-[var(--admin-blue)]"
            >
              {initials(names[0])}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--admin-ink)]">{names.join(", ")}</span>
          </div>
          {canManage && onRemove ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              aria-label={`Remove ${names[0]} from ${label}`}
              title="Remove"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)] disabled:opacity-50"
            >
              <X size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--admin-muted)]">Unassigned</span>
          {canManage && onAssign ? (
            <button
              type="button"
              onClick={onAssign}
              className="inline-flex items-center gap-1 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            >
              <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
              Assign
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}
