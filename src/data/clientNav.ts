export type ClientIconName =
  | "overview"
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
};

export const clientMainNav: ClientNavItem[] = [
  { label: "Overview", href: "/client", icon: "overview", end: true },
  { label: "My Project", href: "/client/project", icon: "project" },
  { label: "Files", href: "/client/files", icon: "files" },
  { label: "Feedback", href: "/client/feedback", icon: "feedback" },
  { label: "Approvals", href: "/client/approvals", icon: "approvals" },
  { label: "Messages", href: "/client/messages", icon: "messages" },
  { label: "Proposals", href: "/client/proposals", icon: "proposals" },
  { label: "Contracts", href: "/client/contracts", icon: "contracts" },
  { label: "Invoices", href: "/client/invoices", icon: "invoices" },
];

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
