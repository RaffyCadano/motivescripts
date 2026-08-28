import type { User } from "@supabase/supabase-js";
import { displayRoleLabel } from "@/auth/roles";

export type UserDisplay = {
  name: string;
  initials: string;
  role: string;
  email: string;
};

export function userDisplay(user: User): UserDisplay {
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const givenName = typeof meta.name === "string" ? meta.name.trim() : "";
  const email = user.email ?? "";
  const name = fullName || givenName || email.split("@")[0] || "Account";

  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
      : name.slice(0, 1).toUpperCase();

  const role = displayRoleLabel(user);

  return { name, initials: initials || "A", role, email };
}
