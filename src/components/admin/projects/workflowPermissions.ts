import { isActiveAdmin, type StaffPermissionCode } from "@/auth/permissions";
import type { AppProfile } from "@/auth/loadProfile";
import type { AdminWorkflowAction } from "@/data/preProject";

export function workflowPrimaryAllowed(
  action: AdminWorkflowAction,
  profile: AppProfile | null,
  canInvite: boolean,
): boolean {
  if (action.primaryKind === "invite") return canInvite;
  if (action.primaryKind === "start_project") return profile?.permissions.includes("projects.manage") ?? false;
  const href = action.primaryHref ?? "";
  if (href.includes("/projects/new")) return profile?.permissions.includes("projects.manage") ?? false;
  if (href.includes("/proposals/new")) return profile?.permissions.includes("proposals.manage") ?? false;
  if (href.includes("/contracts/new")) return profile?.permissions.includes("contracts.manage") ?? false;
  if (href.includes("/invoices/new")) return profile?.permissions.includes("invoices.manage") ?? false;
  if (href.includes("/admin/projects/")) return profile?.permissions.includes("projects.view") ?? false;
  if (href.includes("/proposals/")) return profile?.permissions.includes("proposals.view") ?? false;
  return true;
}

export function workflowSecondaryAllowed(action: AdminWorkflowAction, can: (code: StaffPermissionCode) => boolean): boolean {
  const href = action.secondaryHref ?? "";
  if (href.includes("/projects/new")) return can("projects.manage");
  if (href.includes("/admin/projects/")) return can("projects.view");
  return true;
}

export function canInviteClient(profile: AppProfile | null): boolean {
  return isActiveAdmin(profile);
}
