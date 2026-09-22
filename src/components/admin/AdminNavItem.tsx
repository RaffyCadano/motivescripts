import { NavLink, useLocation } from "react-router-dom";
import { adminIcons } from "@/components/admin/adminIcons";
import type { AdminNavItem as AdminNavItemData } from "@/data/adminNav";
import { cn } from "@/lib/cn";
import { useMessaging } from "@/providers/MessagingProvider";
import { useMyOpenTaskCount } from "@/components/admin/useMyOpenTaskCount";

type AdminNavItemProps = {
  item: AdminNavItemData;
  collapsed: boolean;
  onNavigate?: () => void;
};

export function AdminNavItem({ item, collapsed, onNavigate }: AdminNavItemProps) {
  const Icon = adminIcons[item.icon];
  const { unreadMessageCount } = useMessaging();
  const myTaskCount = useMyOpenTaskCount();
  const badge =
    item.icon === "messages" ? unreadMessageCount : item.href === "/admin/my-tasks" ? myTaskCount : 0;
  const { hash: currentHash } = useLocation();
  // Some PM nav items point at #anchors on the same /admin route, so React Router's own
  // pathname-only isActive would mark all of them active together. An item that targets a
  // hash is only active when that exact hash is current; an item with no hash is only
  // active when the URL has no hash at all.
  const itemHash = item.href.split("#")[1];
  // NavLink's built-in aria-current is also pathname-only, so without this override every
  // item sharing a base path (Overview plus the PM's #anchor items, all on /admin) would get
  // aria-current="page" at once -- a screen reader would announce several links as "current
  // page" with no way to tell which section is actually open. Passing our own hash-aware
  // value here overrides it; NavLink still only applies it when its own path check passes,
  // so items on an unrelated path are unaffected.
  const ariaCurrentOverride = (itemHash ? currentHash === `#${itemHash}` : currentHash === "") ? "page" : "false";

  return (
    <NavLink
      to={item.href}
      end={item.end}
      aria-current={ariaCurrentOverride}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive: pathActive }) => {
        const isActive = pathActive && (itemHash ? currentHash === `#${itemHash}` : currentHash === "");
        return cn(
          "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium tracking-tight transition-colors duration-[var(--duration-fast)]",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--admin-hover)] text-[var(--admin-blue)]"
            : "text-[var(--admin-ink)]/75 hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]",
        );
      }}
    >
      {({ isActive: pathActive }) => {
        const isActive = pathActive && (itemHash ? currentHash === `#${itemHash}` : currentHash === "");
        return (
          <>
            <span className="relative shrink-0">
              <Icon
                size={18}
                strokeWidth={1.75}
                className={cn("shrink-0", isActive ? "text-[var(--admin-blue)]" : "text-[var(--admin-muted)] group-hover:text-[var(--admin-ink)]")}
                aria-hidden="true"
              />
              {collapsed && badge > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--admin-blue)]" aria-hidden="true" />
              ) : null}
            </span>
            {collapsed ? (
              <span className="sr-only">
                {item.label}
                {badge > 0 ? ` (${badge} unread)` : ""}
              </span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">{item.label}</span>
                {badge > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--admin-blue)] px-1.5 text-xs font-semibold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
            )}
          </>
        );
      }}
    </NavLink>
  );
}
