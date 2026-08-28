import { Link } from "react-router-dom";
import { AdminNavItem } from "@/components/admin/AdminNavItem";
import { BrandMark } from "@/components/BrandMark";
import { filterAdminNavGroups } from "@/data/adminNav";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/cn";

type AdminSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  inertWhenClosed: boolean;
  onNavigate: () => void;
};

export function AdminSidebar({ collapsed, mobileOpen, inertWhenClosed, onNavigate }: AdminSidebarProps) {
  const { profile } = useAuth();
  const groups = filterAdminNavGroups(profile);
  return (
    <aside
      id="admin-sidebar"
      inert={inertWhenClosed ? true : undefined}
      aria-hidden={inertWhenClosed ? true : undefined}
      className={cn(
        "flex h-svh flex-col border-r border-[var(--admin-line)] bg-[var(--admin-card)]",
        "fixed inset-y-0 left-0 z-40",
        "transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] lg:translate-x-0 lg:transition-[width]",
        collapsed ? "lg:w-[var(--admin-sidebar-collapsed)]" : "lg:w-[var(--admin-sidebar)]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        "w-[min(var(--admin-sidebar),calc(100vw-2.5rem))]",
      )}
      aria-label="Admin"
    >
      <div
        className={cn(
          "flex h-[var(--admin-header)] shrink-0 items-center border-b border-[var(--admin-line)] px-4",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <Link
          to="/admin"
          className="inline-flex items-center gap-2.5 rounded-sm text-[var(--admin-ink)]"
          aria-label="MotiveScripts admin overview"
          onClick={onNavigate}
        >
          <BrandMark className="h-7 w-auto" decorative />
          <span className={cn("min-w-0", collapsed && "lg:hidden")}>
            <span className="block font-heading text-sm font-extrabold tracking-tight">MotiveScripts</span>
            <span className="block text-[11px] font-medium text-[var(--admin-muted)]">Admin</span>
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Admin sections">
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p
              className={cn(
                "px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]",
                collapsed && "lg:flex lg:justify-center lg:px-0",
              )}
            >
              {collapsed ? (
                <span className="hidden h-px w-4 bg-[var(--admin-line)] lg:block" aria-hidden="true" />
              ) : null}
              <span className={cn(collapsed && "lg:sr-only")}>{group.label}</span>
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <AdminNavItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
