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
  | "activity"
  | "settings";

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
    items: [{ label: "Overview", href: "/admin", icon: "overview", end: true }],
  },
  {
    label: "CRM",
    items: [
      { label: "Leads", href: "/admin/leads", icon: "leads" },
      { label: "Clients", href: "/admin/clients", icon: "clients" },
    ],
  },
  {
    label: "Projects",
    items: [
      { label: "Projects", href: "/admin/projects", icon: "projects" },
      { label: "Tasks", href: "/admin/tasks", icon: "tasks" },
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
      { label: "Payments", href: "/admin/payments", icon: "payments" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Messages", href: "/admin/messages", icon: "messages" },
      { label: "Notifications", href: "/admin/notifications", icon: "notifications" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Team", href: "/admin/team", icon: "team" },
      { label: "Activity", href: "/admin/activity", icon: "activity" },
    ],
  },
  {
    label: "Settings",
    items: [{ label: "Settings", href: "/admin/settings", icon: "settings" }],
  },
];

export function getAdminPageMeta(pathname: string) {
  const items = adminNavGroups.flatMap((group) => group.items);
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact;
  return items.find((item) => item.end && pathname === item.href) ?? items[0];
}
