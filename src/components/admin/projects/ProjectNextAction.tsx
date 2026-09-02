import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyProject } from "@/data/agencyProjects";
import type { AdminWorkflowAction } from "@/data/preProject";
import { canInviteClient, workflowPrimaryAllowed, workflowSecondaryAllowed } from "@/components/admin/projects/workflowPermissions";

export function ProjectNextAction({
  project,
  action,
  loading,
  onInvite,
}: {
  project: AgencyProject | null;
  action: AdminWorkflowAction | null;
  loading: boolean;
  onInvite?: () => void;
}) {
  const { profile } = useAuth();
  const { setProjectStatus } = useLeads();
  const [startOpen, setStartOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const can = (code: Parameters<typeof hasPermission>[1]) => hasPermission(profile, code);
  const canInvite = Boolean(onInvite) && canInviteClient(profile);
  const showPrimary =
    action && action.primaryKind !== "none" && action.primaryLabel && workflowPrimaryAllowed(action, profile, canInvite);
  const showSecondary = action && action.secondaryLabel && action.secondaryHref && workflowSecondaryAllowed(action, can);

  async function startProject() {
    if (!project?.id || starting) return;
    setStarting(true);
    try {
      await setProjectStatus(project.id, "In Development");
      setStartOpen(false);
    } finally {
      setStarting(false);
    }
  }

  if (loading || !action) {
    return <div className="h-28 animate-pulse rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]" />;
  }

  return (
    <>
      <section className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">Next action</p>
        <h2 className="mt-1 font-heading text-lg font-semibold tracking-tight text-[var(--admin-ink)]">{action.title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">{action.body}</p>
        {showPrimary || showSecondary ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            {showPrimary && action.primaryKind === "link" && action.primaryHref ? (
              <Link to={action.primaryHref} className={`${adminPrimaryBtn} justify-center`}>
                {action.primaryLabel}
              </Link>
            ) : null}
            {showPrimary && action.primaryKind === "invite" && onInvite ? (
              <button type="button" className={`${adminPrimaryBtn} justify-center`} onClick={onInvite}>
                {action.primaryLabel}
              </button>
            ) : null}
            {showPrimary && action.primaryKind === "start_project" && project ? (
              <button type="button" className={`${adminPrimaryBtn} justify-center`} onClick={() => setStartOpen(true)}>
                {action.primaryLabel}
              </button>
            ) : null}
            {showSecondary && action.secondaryDisabled ? (
              <button
                type="button"
                disabled
                title={action.secondaryDisabledReason}
                className={`${adminGhostBtn} cursor-not-allowed justify-center opacity-50`}
              >
                {action.secondaryLabel}
              </button>
            ) : null}
            {showSecondary && !action.secondaryDisabled ? (
              <Link to={action.secondaryHref!} className={`${adminGhostBtn} justify-center`}>
                {action.secondaryLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <AdminDialog
        open={startOpen}
        busy={starting}
        title="Start production?"
        description="This sets the project status to In Development. Payment is already recorded."
        onClose={() => {
          if (!starting) setStartOpen(false);
        }}
      >
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={`${adminGhostBtn} justify-center`} disabled={starting} onClick={() => setStartOpen(false)}>
            Cancel
          </button>
          <button type="button" className={`${adminPrimaryBtn} justify-center`} disabled={starting} onClick={() => void startProject()}>
            {starting ? "Starting…" : "Start Project"}
          </button>
        </div>
      </AdminDialog>
    </>
  );
}
