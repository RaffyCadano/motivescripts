import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { cn } from "@/lib/cn";
import "@/styles/admin.css";

export function AdminLayout() {
  const { pathname } = useLocation();
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
    document.getElementById("admin-main")?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  const dockCollapsed = isLg && collapsed;

  return (
    <div className="admin-app">
      <a className="skip-link" href="#admin-main">
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

      <AdminSidebar
        collapsed={dockCollapsed}
        mobileOpen={mobileOpen}
        inertWhenClosed={!isLg && !mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-h-svh flex-col transition-[padding] duration-[var(--duration-base)] ease-[var(--ease-out)]",
          dockCollapsed ? "lg:pl-[var(--admin-sidebar-collapsed)]" : "lg:pl-[var(--admin-sidebar)]",
        )}
      >
        <AdminHeader
          collapsed={dockCollapsed}
          mobileOpen={mobileOpen}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main id="admin-main" className="min-h-0 flex-1 overflow-auto p-4 md:p-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
