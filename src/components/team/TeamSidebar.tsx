import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { BrandMark } from "@/components/BrandMark";
import { TeamNavItem } from "@/components/team/TeamNavItem";
import { canOpenAdminWorkspace, filterTeamNav, teamAccountNav, teamMainNav } from "@/data/teamNav";
import { cn } from "@/lib/cn";

type TeamSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  inertWhenClosed: boolean;
  onNavigate: () => void;
};

export function TeamSidebar({ collapsed, mobileOpen, inertWhenClosed, onNavigate }: TeamSidebarProps) {
  const { profile } = useAuth();
  const main = filterTeamNav(teamMainNav, profile);
  const account = filterTeamNav(teamAccountNav, profile);
  const showAdmin = canOpenAdminWorkspace(profile);

  return (
    <aside
      id="team-sidebar"
      aria-hidden={inertWhenClosed ? true : undefined}
      className={cn(
        "pointer-events-auto flex h-svh flex-col border-r border-[var(--admin-line)] bg-[var(--admin-card)]",
        "fixed inset-y-0 left-0 z-50",
        "transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] lg:translate-x-0 lg:transition-[width]",
        collapsed ? "lg:w-[var(--admin-sidebar-collapsed)]" : "lg:w-[var(--admin-sidebar)]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        !mobileOpen && "max-lg:pointer-events-none",
        "w-[min(var(--admin-sidebar),calc(100vw-2.5rem))]",
      )}
      aria-label="Team workspace"
    >
      <div
        className={cn(
          "flex h-[var(--admin-header)] shrink-0 items-center border-b border-[var(--admin-line)] px-4",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <Link
          to="/team/dashboard"
          className="inline-flex items-center gap-2.5 rounded-sm text-[var(--admin-ink)]"
          aria-label="MotiveScripts team dashboard"
          onClick={onNavigate}
        >
          <BrandMark className="h-7 w-auto" decorative />
          <span className={cn("min-w-0", collapsed && "lg:hidden")}>
            <span className="block font-heading text-sm font-extrabold tracking-tight">MotiveScripts</span>
            <span className="block text-[11px] font-medium text-[var(--admin-muted)]">Team</span>
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Team sections">
        <div className="flex flex-col gap-0.5">
          {main.map((item) => (
            <TeamNavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        <div className={cn("my-4 border-t border-[var(--admin-line)]", collapsed ? "mx-2" : "mx-3")} role="separator" />
        <div className="flex flex-col gap-0.5">
          {account.map((item) => (
            <TeamNavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
          {showAdmin ? (
            <TeamNavItem
              item={{ label: "Admin", href: "/admin", icon: "team" }}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
