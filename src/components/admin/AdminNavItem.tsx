import { NavLink } from "react-router-dom";
import { adminIcons } from "@/components/admin/adminIcons";
import type { AdminNavItem as AdminNavItemData } from "@/data/adminNav";
import { cn } from "@/lib/cn";

type AdminNavItemProps = {
  item: AdminNavItemData;
  collapsed: boolean;
  onNavigate?: () => void;
};

export function AdminNavItem({ item, collapsed, onNavigate }: AdminNavItemProps) {
  const Icon = adminIcons[item.icon];

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
          <Icon
            size={18}
            strokeWidth={1.75}
            className={cn("shrink-0", isActive ? "text-[var(--admin-blue)]" : "text-[var(--admin-muted)] group-hover:text-[var(--admin-ink)]")}
            aria-hidden="true"
          />
          {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}
