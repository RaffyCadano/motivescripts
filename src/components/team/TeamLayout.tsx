import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isOfficeStaff } from "@/auth/roles";
import { AgencyLoadPanel } from "@/components/admin/leads/AgencyLoadPanel";
import { LeadToast } from "@/components/admin/leads/LeadToast";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { TeamDirectoryProvider } from "@/components/admin/team/useTeamDirectory";
import { TeamHeader } from "@/components/team/TeamHeader";
import { TeamSidebar } from "@/components/team/TeamSidebar";
import { cn } from "@/lib/cn";
import "@/styles/admin.css";

export function TeamLayout() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const { loadStatus, loadError, reload } = useLeads();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isLg, setIsLg] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsLg(media.matches);
      if (media.matches) setMobileOpen(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-shell");
    return () => root.classList.remove("admin-shell");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (mobileOpen) root.classList.add("admin-nav-open");
    else root.classList.remove("admin-nav-open");

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) window.addEventListener("keydown", onKey);

    return () => {
      root.classList.remove("admin-nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  useEffect(() => {
    document.getElementById("team-main")?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  const dockCollapsed = isLg && collapsed;

  if (isOfficeStaff(profile)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <TeamDirectoryProvider>
      <div className="admin-app h-svh overflow-hidden">
        <a className="skip-link" href="#team-main">
          Skip to content
        </a>

        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-[rgb(7_17_31_/_0.32)] lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <TeamSidebar
          collapsed={dockCollapsed}
          mobileOpen={mobileOpen}
          inertWhenClosed={!isLg && !mobileOpen}
          onNavigate={() => setMobileOpen(false)}
        />

        <div
          className={cn(
            "relative z-0 flex h-full min-h-0 flex-col pt-[var(--admin-header)] pointer-events-none transition-[margin] duration-[var(--duration-base)] ease-[var(--ease-out)]",
            dockCollapsed ? "lg:ml-[var(--admin-sidebar-collapsed)]" : "lg:ml-[var(--admin-sidebar)]",
          )}
        >
          <TeamHeader
            collapsed={dockCollapsed}
            mobileOpen={mobileOpen}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <main id="team-main" className="pointer-events-auto min-h-0 flex-1 overflow-auto p-4 md:p-6 lg:px-8 lg:py-7">
            {loadStatus === "ready" ? (
              <Outlet />
            ) : (
              <AgencyLoadPanel
                status={loadStatus}
                error={loadError}
                loadingTitle={
                  pathname.includes("messages")
                    ? "Loading messages…"
                    : pathname.includes("files")
                      ? "Loading files…"
                      : pathname.includes("projects")
                        ? "Loading your project…"
                        : "Loading your work…"
                }
                onRetry={() => void reload()}
              />
            )}
            <LeadToast />
          </main>
        </div>
      </div>
    </TeamDirectoryProvider>
  );
}
