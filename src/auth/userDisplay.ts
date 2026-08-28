import type { User } from "@supabase/supabase-js";
import type { AppProfile } from "@/auth/loadProfile";
import { displayRoleLabel } from "@/auth/roles";

export type UserDisplay = {
  name: string;
  initials: string;
  role: string;
  email: string;
};

export function initialsFromName(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
      : name.slice(0, 1).toUpperCase();
  return initials || "A";
}

export function firstNameFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[0] || name.trim() || "there";
}

export function userDisplay(user: User, profile?: AppProfile | null): UserDisplay {
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const givenName = typeof meta.name === "string" ? meta.name.trim() : "";
  const email = profile?.email ?? user.email ?? "";
  const name = profile?.fullName.trim() || fullName || givenName || email.split("@")[0] || "Account";

  return {
    name,
    initials: initialsFromName(name),
    role: displayRoleLabel(profile?.role),
    email,
  };
}
