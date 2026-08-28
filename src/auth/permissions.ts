import type { AppProfile } from "@/auth/loadProfile";
import { isAgencyRole } from "@/auth/roles";

export const STAFF_PERMISSION_CODES = [
  "leads.view",
  "leads.manage",
  "clients.view",
  "clients.manage",
  "projects.view",
  "projects.manage",
  "files.view",
  "files.manage",
  "feedback.manage",
  "proposals.view",
  "proposals.manage",
  "contracts.view",
  "contracts.manage",
  "invoices.view",
  "invoices.manage",
  "messages.view",
  "messages.manage",
  "team.view",
  "team.manage",
  "activity.view",
] as const;

export type StaffPermissionCode = (typeof STAFF_PERMISSION_CODES)[number];

export function isStaffPermission(value: string): value is StaffPermissionCode {
  return (STAFF_PERMISSION_CODES as readonly string[]).includes(value);
}

export function isActiveAgency(profile: AppProfile | null | undefined): boolean {
  return Boolean(profile && isAgencyRole(profile.role) && profile.isActive);
}

export function isActiveAdmin(profile: AppProfile | null | undefined): boolean {
  return Boolean(profile && profile.role === "admin" && profile.isActive);
}

export function hasPermission(
  profile: AppProfile | null | undefined,
  code: StaffPermissionCode,
): boolean {
  if (!isActiveAgency(profile) || !profile) return false;
  if (profile.role === "admin") return true;
  return profile.permissions.includes(code);
}
