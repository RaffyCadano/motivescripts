export const APP_ROLES = ["admin", "staff", "client"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ADMIN_ROLE = "admin";
export const STAFF_ROLE = "staff";
export const CLIENT_ROLE = "client";

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value === "admin" || value === "staff" || value === "client";
}

export function isAgencyRole(value: string | null | undefined): boolean {
  return value === "admin" || value === "staff";
}

export function displayRoleLabel(role: string | null | undefined): string {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  if (role === "client") return "Client";
  return "User";
}

export const PRODUCTION_TEAM_TEMPLATES = new Set<string>([
  "developer",
  "designer",
  "content_writer",
  "team_member",
]);

export const PRODUCTION_COMMUNICATOR_TEMPLATES = new Set<string>([
  "developer",
  "designer",
  "content_writer",
]);

export function isProductionTeamTemplate(templateKey: string | null | undefined): boolean {
  return PRODUCTION_TEAM_TEMPLATES.has(templateKey ?? "");
}

/** Designer, Developer, and Content Writer may message assigned project clients. Team Member may not. */
export function isProductionCommunicator(
  profile: { role?: string | null; templateKey?: string | null } | null | undefined,
): boolean {
  return profile?.role === "staff" && PRODUCTION_COMMUNICATOR_TEMPLATES.has(profile.templateKey ?? "");
}

export function usesTeamWorkspace(
  profile: { role?: string | null; templateKey?: string | null } | null | undefined,
): boolean {
  return profile?.role === "staff" && isProductionTeamTemplate(profile.templateKey);
}

export function isProjectManager(
  profile:
    | { role?: string | null; templateKey?: string | null; permissions?: string[] }
    | null
    | undefined,
): boolean {
  if (!profile || profile.role !== "staff") return false;
  if (profile.templateKey === "project_manager") return true;
  return hasProjectManagerPermissionFootprint(profile.permissions ?? []);
}

const PM_TEMPLATE_PERMISSIONS = [
  "clients.view",
  "clients.manage",
  "projects.view",
  "projects.manage",
  "files.view",
  "files.manage",
  "feedback.manage",
  "messages.view",
  "messages.manage",
  "activity.view",
] as const;

const NON_PM_TEMPLATE_PERMISSIONS = [
  "leads.view",
  "proposals.view",
  "contracts.view",
  "invoices.view",
  "team.manage",
] as const;

export function hasProjectManagerPermissionFootprint(permissions: string[]): boolean {
  if (permissions.length === 0) return false;
  const granted = new Set(permissions);
  if (NON_PM_TEMPLATE_PERMISSIONS.some((code) => granted.has(code))) return false;
  return PM_TEMPLATE_PERMISSIONS.every((code) => granted.has(code));
}

/** PM, Sales, Accounting, and other non-production staff belong on /admin. */
export function isOfficeStaff(
  profile: { role?: string | null; templateKey?: string | null } | null | undefined,
): boolean {
  return profile?.role === "staff" && !isProductionTeamTemplate(profile.templateKey);
}

export function agencyHomePath(
  profile: { role?: string | null; templateKey?: string | null } | null | undefined,
): string {
  if (!profile) return "/login";
  if (profile.role === "client") return "/client";
  if (profile.role === "admin") return "/admin";
  if (usesTeamWorkspace(profile)) return "/team/dashboard";
  if (isAgencyRole(profile.role)) return "/admin";
  return "/login";
}

export function adminPathToTeamPath(pathname: string, search = ""): string {
  const project = pathname.match(/^\/admin\/projects\/([^/]+)(?:\/edit)?$/);
  if (project) return `/team/projects/${project[1]}${search}`;
  if (pathname === "/admin/projects" || pathname.startsWith("/admin/projects/")) return "/team/projects";
  if (pathname.startsWith("/admin/files")) return "/team/files";
  if (pathname.startsWith("/admin/messages")) {
    return `${pathname.replace("/admin/messages", "/team/messages")}${search}`;
  }
  return "/team/dashboard";
}
