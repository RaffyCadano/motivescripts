import { NavLink } from "react-router-dom";
import { clientIcons } from "@/components/client/clientIcons";
import type { ClientNavItem as ClientNavItemData } from "@/data/clientNav";
import { cn } from "@/lib/cn";
import { useMessaging } from "@/providers/MessagingProvider";

type ClientNavItemProps = {
  item: ClientNavItemData;
  collapsed?: boolean;
  onNavigate?: () => void;
};

export function ClientNavItem({ item, collapsed = false, onNavigate }: ClientNavItemProps) {
  const Icon = clientIcons[item.icon];
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
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium tracking-tight transition-colors duration-[var(--duration-fast)]",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--client-hover)] text-[var(--client-blue)]"
            : "text-[var(--client-ink)]/80 hover:bg-[var(--client-bg)] hover:text-[var(--client-ink)]",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative shrink-0">
            <Icon
              size={18}
              strokeWidth={1.75}
              className={cn(
                "shrink-0",
                isActive ? "text-[var(--client-blue)]" : "text-[var(--client-muted)]",
              )}
              aria-hidden="true"
            />
            {collapsed && badge > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--client-blue)]" aria-hidden="true" />
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
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--client-blue)] px-1.5 text-[10px] font-semibold text-white">
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
