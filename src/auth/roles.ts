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

export function isProductionTeamTemplate(templateKey: string | null | undefined): boolean {
  return PRODUCTION_TEAM_TEMPLATES.has(templateKey ?? "");
}

export function usesTeamWorkspace(
  profile: { role?: string | null; templateKey?: string | null } | null | undefined,
): boolean {
  return profile?.role === "staff" && isProductionTeamTemplate(profile.templateKey);
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
