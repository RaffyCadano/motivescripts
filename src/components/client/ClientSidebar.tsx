import { Link } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { ClientNavItem } from "@/components/client/ClientNavItem";
import { clientMainNavFor, clientSettingsNav } from "@/data/clientNav";
import { usePortalIdentity, usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { cn } from "@/lib/cn";

type ClientSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  inertWhenClosed: boolean;
  onNavigate: () => void;
};

export function ClientSidebar({ collapsed, mobileOpen, inertWhenClosed, onNavigate }: ClientSidebarProps) {
  const identity = usePortalIdentity();
  const { project } = usePortalSession();
  const mainNav = clientMainNavFor(Boolean(project));
  const portalLabel = project ? "Client Portal" : "Pre-Project";
  return (
    <aside
      id="client-sidebar"
      inert={inertWhenClosed ? true : undefined}
      aria-hidden={inertWhenClosed ? true : undefined}
      className={cn(
        "flex h-svh flex-col border-r border-[var(--client-line)] bg-[var(--client-card)]",
        "fixed inset-y-0 left-0 z-40",
        "transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] lg:translate-x-0 lg:transition-[width]",
        collapsed ? "lg:w-[var(--client-sidebar-collapsed)]" : "lg:w-[var(--client-sidebar)]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        "w-[min(var(--client-sidebar),calc(100vw-2.5rem))]",
      )}
      aria-label="Client portal"
    >
      <div
        className={cn(
          "flex h-[var(--client-header)] shrink-0 items-center border-b border-[var(--client-line)] px-5",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <Link
          to="/client"
          className="inline-flex items-center gap-2.5 rounded-sm text-[var(--client-ink)]"
          aria-label="MotiveScripts client portal overview"
          onClick={onNavigate}
        >
          <BrandMark className="h-7 w-auto" decorative />
          <span className={cn("min-w-0", collapsed && "lg:hidden")}>
            <span className="block font-heading text-sm font-extrabold tracking-tight">MotiveScripts</span>
            <span className="block text-[11px] font-medium text-[var(--client-muted)]">{portalLabel}</span>
          </span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label={project ? "Project" : "Pre-project"}>
        <div className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <ClientNavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>

        <div className={cn("my-4 border-t border-[var(--client-line)]", collapsed ? "mx-2" : "mx-3")} role="separator" />

        <div className="flex flex-col gap-0.5">
          {clientSettingsNav.map((item) => (
            <ClientNavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className={cn("shrink-0 border-t border-[var(--client-line)] px-4 py-4", collapsed && "lg:px-0 lg:py-3")}>
        <div className={cn("flex items-center gap-3", collapsed && "lg:justify-center")}>
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--client-navy)] font-heading text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {identity.initials}
          </span>
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <p className="truncate font-heading text-[13px] font-semibold text-[var(--client-ink)]">
              {identity.businessName}
            </p>
            <p className="truncate text-[11px] text-[var(--client-muted)]">{project ? "Client" : "Pre-Project"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
