import type { User } from "@supabase/supabase-js";

export const ADMIN_ROLE = "admin";

export function getUserRole(user: User | null | undefined): string | null {
  const role = user?.app_metadata?.role;
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase();
  return normalized || null;
}

export function isAdminUser(user: User | null | undefined): boolean {
  return getUserRole(user) === ADMIN_ROLE;
}

export function displayRoleLabel(user: User | null | undefined): string {
  const role = getUserRole(user);
  if (!role) return "User";
  return role.charAt(0).toUpperCase() + role.slice(1);
}
