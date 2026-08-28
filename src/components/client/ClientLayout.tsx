import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AgencyLoadPanel } from "@/components/admin/leads/AgencyLoadPanel";
import { LeadToast } from "@/components/admin/leads/LeadToast";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { ClientHeader } from "@/components/client/ClientHeader";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { cn } from "@/lib/cn";
import "@/styles/client.css";

/**
 * Client portal shell. Route guards require an authenticated client role.
 * RLS limits rows to that client’s records.
 */
export function ClientLayout() {
  const { pathname } = useLocation();
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
    if (mobileOpen) root.classList.add("client-nav-open");
    else root.classList.remove("client-nav-open");

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) window.addEventListener("keydown", onKey);

    return () => {
      root.classList.remove("client-nav-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  useEffect(() => {
    document.getElementById("client-main")?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  const dockCollapsed = isLg && collapsed;

  return (
    <div className="client-app">
      <a className="skip-link" href="#client-main">
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

      <ClientSidebar
        collapsed={dockCollapsed}
        mobileOpen={mobileOpen}
        inertWhenClosed={!isLg && !mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex h-svh w-full min-w-0 flex-col overflow-hidden transition-[padding] duration-[var(--duration-base)] ease-[var(--ease-out)]",
          dockCollapsed ? "lg:pl-[var(--client-sidebar-collapsed)]" : "lg:pl-[var(--client-sidebar)]",
        )}
      >
        <ClientHeader
          collapsed={dockCollapsed}
          mobileOpen={mobileOpen}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main
          id="client-main"
          className="min-h-0 w-full min-w-0 flex-1 overflow-auto px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-9"
        >
          {loadStatus === "ready" ? (
            <Outlet />
          ) : (
            <AgencyLoadPanel
              status={loadStatus}
              error={loadError}
              loadingTitle={
                pathname.includes("messages")
                  ? "Loading messages…"
                  : pathname.includes("files") || pathname.includes("feedback") || pathname.includes("approvals")
                    ? "Loading files…"
                    : "Loading project…"
              }
              onRetry={() => void reload()}
            />
          )}
          <LeadToast />
        </main>
      </div>
    </div>
  );
}
