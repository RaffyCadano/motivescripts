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

export function agencyHomePath(
  profile: { role?: string | null; templateKey?: string | null } | null | undefined,
): string {
  if (!profile) return "/login";
  if (profile.role === "client") return "/client";
  if (profile.role === "admin") return "/admin";
  if (
    profile.role === "staff" &&
    (profile.templateKey === "developer" ||
      profile.templateKey === "designer" ||
      profile.templateKey === "content_writer" ||
      profile.templateKey === "team_member")
  ) {
    return "/team/dashboard";
  }
  if (isAgencyRole(profile.role)) return "/admin";
  return "/login";
}
