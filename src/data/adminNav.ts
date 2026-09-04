import type { AppProfile } from "@/auth/loadProfile";
import { hasPermission, isActiveAdmin, type StaffPermissionCode } from "@/auth/permissions";
import { isProjectManager } from "@/auth/roles";

export type AdminIconName =
  | "overview"
  | "leads"
  | "clients"
  | "projects"
  | "tasks"
  | "files"
  | "proposals"
  | "contracts"
  | "invoices"
  | "payments"
  | "messages"
  | "notifications"
  | "team"
  | "capacity"
  | "payroll"
  | "time"
  | "activity"
  | "settings"
  | "profile";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: AdminIconName;
  end?: boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Overview", href: "/admin", icon: "overview", end: true },
      { label: "My Tasks", href: "/admin/my-tasks", icon: "tasks" },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Leads", href: "/admin/leads", icon: "leads" },
      { label: "Clients", href: "/admin/clients", icon: "clients" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { label: "Projects", href: "/admin/projects", icon: "projects" },
      { label: "Files", href: "/admin/files", icon: "files" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Proposals", href: "/admin/proposals", icon: "proposals" },
      { label: "Contracts", href: "/admin/contracts", icon: "contracts" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Invoices", href: "/admin/invoices", icon: "invoices" },
      { label: "Payroll", href: "/admin/payroll", icon: "payroll" },
    ],
  },
  {
    label: "Communication",
    items: [{ label: "Messages", href: "/admin/messages", icon: "messages" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Team", href: "/admin/team", icon: "team" },
      { label: "Capacity", href: "/admin/capacity", icon: "capacity" },
      { label: "Settings", href: "/admin/settings", icon: "settings" },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Profile", href: "/admin/profile", icon: "profile" }],
  },
];

/**
 * PM's working set is a curated subset of the same `/admin` routes (no new routes),
 * grouped around "my work" instead of the agency-wide CRM/Sales/Finance/Operations
 * groupings admin sees. Still pruned by `navPermission` below, so it degrades safely
 * if a PM's grants ever change.
 */
export const pmNavGroups: AdminNavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Overview", href: "/admin", icon: "overview", end: true },
      { label: "My Tasks", href: "/admin/my-tasks", icon: "tasks" },
    ],
  },
  {
    label: "My Work",
    items: [
      { label: "Projects", href: "/admin/projects", icon: "projects" },
      { label: "Clients", href: "/admin/clients", icon: "clients" },
      { label: "Files", href: "/admin/files", icon: "files" },
      { label: "Capacity", href: "/admin/capacity", icon: "capacity" },
    ],
  },
  {
    label: "Communication",
    items: [{ label: "Messages", href: "/admin/messages", icon: "messages" }],
  },
  {
    label: "Account",
    items: [{ label: "Profile", href: "/admin/profile", icon: "profile" }],
  },
];

/** Collapses a sub-route (e.g. "/admin/leads/42") back to its canonical nav path ("/admin/leads"). */
function resolveAdminNavPath(pathname: string): string {
  if (pathname === "/admin/leads" || pathname.startsWith("/admin/leads/")) return "/admin/leads";
  if (pathname === "/admin/clients" || pathname.startsWith("/admin/clients/")) return "/admin/clients";
  if (pathname === "/admin/messages" || pathname.startsWith("/admin/messages/")) return "/admin/messages";
  if (pathname === "/admin/my-tasks") return "/admin/my-tasks";
  if (pathname === "/admin/projects" || pathname.startsWith("/admin/projects/")) return "/admin/projects";
  if (pathname === "/admin/proposals" || pathname.startsWith("/admin/proposals/")) return "/admin/proposals";
  if (pathname === "/admin/contracts" || pathname.startsWith("/admin/contracts/")) return "/admin/contracts";
  if (pathname === "/admin/invoices" || pathname.startsWith("/admin/invoices/")) return "/admin/invoices";
  if (pathname === "/admin/team" || pathname.startsWith("/admin/team/")) return "/admin/team";
  if (pathname === "/admin/settings" || pathname.startsWith("/admin/settings/")) return "/admin/settings";
  if (pathname === "/admin/profile") return "/admin/profile";
  return pathname;
}

export function getAdminPageMeta(pathname: string) {
  const unavailable = adminUnavailablePages[pathname];
  if (unavailable) {
    return { label: unavailable.label, href: pathname, icon: unavailable.icon };
  }
  const items = adminNavGroups.flatMap((group) => group.items);
  const canonical = resolveAdminNavPath(pathname);
  const match = items.find((item) => item.href === canonical);
  if (match) return match;
  return items.find((item) => item.end && pathname === item.href) ?? items[0];
}

const navPermission: Record<string, StaffPermissionCode | null> = {
  "/admin": null,
  "/admin/leads": "leads.view",
  "/admin/clients": "clients.view",
  "/admin/my-tasks": "projects.view",
  "/admin/projects": "projects.view",
  "/admin/files": "files.view",
  "/admin/proposals": "proposals.view",
  "/admin/contracts": "contracts.view",
  "/admin/invoices": "invoices.view",
  "/admin/payments": "invoices.view",
  "/admin/messages": "messages.view",
  "/admin/notifications": null,
  "/admin/team": "team.view",
  "/admin/capacity": "projects.view",
  "/admin/payroll": null,
  "/admin/activity": "activity.view",
  "/admin/settings": null,
  "/admin/profile": null,
};

/** The permission code required to view this route, or null if any active agency user may. */
export function getRequiredAdminPermission(pathname: string): StaffPermissionCode | null {
  return navPermission[resolveAdminNavPath(pathname)] ?? null;
}

export const adminUnavailablePages: Record<
  string,
  { label: string; icon: AdminIconName; description: string; hint: string }
> = {
  "/admin/notifications": {
    label: "Notifications",
    icon: "notifications",
    description: "A dedicated notifications page is not available in this release.",
    hint: "Unread alerts are in the header bell. Messages live under Messages.",
  },
  "/admin/activity": {
    label: "Activity",
    icon: "activity",
    description: "A workspace-wide activity feed is not available in this release.",
    hint: "Project activity is on each project’s overview.",
  },
};

export function filterAdminNavGroups(profile: AppProfile | null): AdminNavGroup[] {
  const baseGroups = isProjectManager(profile) ? pmNavGroups : adminNavGroups;
  return baseGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.href === "/admin/settings") return isActiveAdmin(profile);
        if (item.href === "/admin/payroll") return isActiveAdmin(profile);
        if (item.href === "/admin/my-tasks" && isActiveAdmin(profile)) return false;
        const required = navPermission[item.href];
        if (!required) return true;
        return hasPermission(profile, required);
      }),
    }))
    .filter((group) => group.items.length > 0);
}
