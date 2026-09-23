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
  | "settings"
  | "plans";

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

/**
 * Not rendered in the sidebar -- reached from the profile dropdown in the header instead (like an
 * "Upgrade" link lives in account menus elsewhere), since it's about the account's billing
 * relationship rather than the project work the main nav is organized around. Still registered here
 * so the header can resolve its page title.
 */
export const clientAccountNav: ClientNavItem[] = [
  { label: "Plans & Website Care", href: "/client/plans", icon: "plans" },
];

export function getClientPageMeta(pathname: string): ClientNavItem {
  const items = [...clientMainNav, ...clientSettingsNav, ...clientAccountNav];
  const exact = items.find((item) => item.href === pathname);
  if (exact) return exact;
  const nested = items
    .filter((item) => !item.end && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return nested;
  return items.find((item) => item.end && pathname === item.href) ?? items[0];
}
