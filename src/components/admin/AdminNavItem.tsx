import { NavLink } from "react-router-dom";
import { adminIcons } from "@/components/admin/adminIcons";
import type { AdminNavItem as AdminNavItemData } from "@/data/adminNav";
import { cn } from "@/lib/cn";
import { useMessaging } from "@/providers/MessagingProvider";

type AdminNavItemProps = {
  item: AdminNavItemData;
  collapsed: boolean;
  onNavigate?: () => void;
};

export function AdminNavItem({ item, collapsed, onNavigate }: AdminNavItemProps) {
  const Icon = adminIcons[item.icon];
  const { unreadMessageCount } = useMessaging();
  const badge = item.icon === "messages" ? unreadMessageCount : 0;

  return (
    <NavLink
      to={item.href}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium tracking-tight transition-colors duration-[var(--duration-fast)]",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--admin-hover)] text-[var(--admin-blue)]"
            : "text-[var(--admin-ink)]/75 hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]",
        )
      }
    >
      {({ isActive }) => (
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
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--admin-blue)] px-1.5 text-[10px] font-semibold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
