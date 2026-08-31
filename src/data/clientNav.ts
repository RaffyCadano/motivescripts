export type ClientIconName =
  | "overview"
  | "scope"
  | "project"
  | "files"
  | "feedback"
  | "approvals"
  | "messages"
  | "proposals"
  | "contracts"
  | "invoices"
  | "settings";

export type ClientNavItem = {
  label: string;
  href: string;
  icon: ClientIconName;
  end?: boolean;
  requiresProject?: boolean;
};

export const clientMainNav: ClientNavItem[] = [
  { label: "Overview", href: "/client", icon: "overview", end: true },
  { label: "Scope", href: "/client/scope", icon: "scope" },
  { label: "My Project", href: "/client/project", icon: "project", requiresProject: true },
  { label: "Files", href: "/client/files", icon: "files", requiresProject: true },
  { label: "Feedback", href: "/client/feedback", icon: "feedback", requiresProject: true },
  { label: "Approvals", href: "/client/approvals", icon: "approvals", requiresProject: true },
  { label: "Messages", href: "/client/messages", icon: "messages" },
  { label: "Proposals", href: "/client/proposals", icon: "proposals" },
  { label: "Contracts", href: "/client/contracts", icon: "contracts" },
  { label: "Invoices", href: "/client/invoices", icon: "invoices" },
];

export function clientMainNavFor(hasProject: boolean): ClientNavItem[] {
  return clientMainNav.filter((item) => hasProject || !item.requiresProject);
}

export const clientSettingsNav: ClientNavItem[] = [
  { label: "Settings", href: "/client/settings", icon: "settings" },
];

export function getClientPageMeta(pathname: string): ClientNavItem {
  const items = [...clientMainNav, ...clientSettingsNav];
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact;
  const nested = items
    .filter((item) => !item.end && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return nested;
  return items.find((item) => item.end && pathname === item.href) ?? items[0];
}
