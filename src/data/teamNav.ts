import type { AppProfile } from "@/auth/loadProfile";
import { hasPermission, type StaffPermissionCode } from "@/auth/permissions";
import { isDeveloper } from "@/auth/roles";
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
      { label: "My Time", href: "/team/time", icon: "time" },
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

/**
 * Same routes as teamNavGroups, relabeled/regrouped for developers so the sidebar reads
 * like a development workspace instead of the generic staff portal. QA & Review, Needs
 * Changes, Blocked, and Deployments are their own standalone pages (TeamQaReview,
 * TeamNeedsChanges, TeamBlocked, TeamDeployments) rather than dashboard-only sections.
 */
export const developerNavGroups: TeamNavGroup[] = [
  {
    label: "Developer",
    items: [
      { label: "Overview", href: "/team/dashboard", icon: "overview", end: true },
      { label: "My Tasks", href: "/team/tasks", icon: "tasks" },
      { label: "My Projects", href: "/team/projects", icon: "projects" },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "QA & Review", href: "/team/qa-review", icon: "qa" },
      { label: "Needs Changes", href: "/team/needs-changes", icon: "needsChanges" },
      { label: "Blocked", href: "/team/blocked", icon: "blocked" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { label: "Deployments", href: "/team/deployments", icon: "deployments" },
      { label: "Time Tracking", href: "/team/time", icon: "time" },
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
  const baseGroups = isDeveloper(profile) ? developerNavGroups : teamNavGroups;
  return baseGroups
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
