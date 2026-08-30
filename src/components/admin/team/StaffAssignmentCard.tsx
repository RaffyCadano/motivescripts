import { useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import type { TeamMember } from "@/data/team";
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
  onChanged: () => void;
};

export function StaffAssignmentCard({
  kind,
  entityId,
  entityClientId,
  members,
  assignedUserIds,
  assignedLabels,
  onChanged,
}: StaffAssignmentCardProps) {
  const { profile } = useAuth();
  const canManage = isActiveAdmin(profile);
  const [userId, setUserId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigned = members.filter((member) => assignedUserIds.includes(member.id));
  const eligible = useMemo(() => {
    return members.filter((member) => {
      if (!member.isActive) return false;
      if (assignedUserIds.includes(member.id)) return false;
      if (member.role === "admin") return true;
      if (kind === "project" && entityClientId) {
        const clientIds = new Set(member.clientAssignments.map((item) => item.entityId));
        if (clientIds.size > 0 && !clientIds.has(entityClientId)) return false;
      }
      return true;
    });
  }, [assignedUserIds, entityClientId, kind, members]);

  async function assign() {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const member = members.find((item) => item.id === userId);
      if (kind === "client") await assignStaffToClient(entityId, userId, label);
      else {
        if (entityClientId && member?.role === "admin") {
          await assignStaffToClient(entityClientId, userId, label);
        }
        await assignStaffToProject(entityId, userId, label);
      }
      setUserId("");
      setLabel("");
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
      onChanged();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to assign this team member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
        {kind === "client" ? "Assigned Team" : "Team"}
      </h2>
      {assigned.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--admin-muted)]">No team members assigned yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {assigned.map((member) => (
            <li key={member.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--admin-ink)]">{member.fullName || member.email}</p>
                <p className="text-[12px] text-[var(--admin-muted)]">
                  {assignedLabels[member.id] || member.jobTitle || member.templateLabel}
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
          ))}
        </ul>
      )}
      {canManage ? (
        <div className="mt-4 space-y-2 border-t border-[var(--admin-line)] pt-4">
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
