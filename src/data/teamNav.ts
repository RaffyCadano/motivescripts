import type { AppProfile } from "@/auth/loadProfile";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import type { AdminIconName } from "@/data/adminNav";

export type TeamNavItem = {
  label: string;
  href: string;
  icon: AdminIconName;
  end?: boolean;
};

export type TeamNavGroup = {
  label: string;
  items: TeamNavItem[];
};

export const teamNavGroups: TeamNavGroup[] = [
  {
    label: "Main",
    items: [{ label: "Dashboard", href: "/team/dashboard", icon: "overview", end: true }],
  },
  {
    label: "Delivery",
    items: [
      { label: "My Tasks", href: "/team/tasks", icon: "tasks" },
      { label: "My Projects", href: "/team/projects", icon: "projects" },
      { label: "Files", href: "/team/files", icon: "files" },
    ],
  },
  {
    label: "Communication",
    items: [{ label: "Messages", href: "/team/messages", icon: "messages" }],
  },
  {
    label: "Account",
    items: [{ label: "Profile", href: "/team/profile", icon: "settings" }],
  },
];

const navPermission: Partial<Record<string, StaffPermissionCode>> = {
  "/team/messages": "messages.view",
  "/team/files": "files.view",
};

export function filterTeamNavGroups(profile: AppProfile | null): TeamNavGroup[] {
  return teamNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const required = navPermission[item.href];
        if (!required) return true;
        return hasPermission(profile, required);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function getTeamPageMeta(pathname: string): TeamNavItem {
  const items = teamNavGroups.flatMap((group) => group.items);
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact;
  const nested = items
    .filter((item) => !item.end && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return nested;
  return items[0];
}

export function canOpenAdminWorkspace(profile: AppProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.role === "admin" ||
    hasPermission(profile, "leads.view") ||
    hasPermission(profile, "invoices.view") ||
    hasPermission(profile, "proposals.view") ||
    hasPermission(profile, "contracts.view") ||
    hasPermission(profile, "team.view")
  );
}
