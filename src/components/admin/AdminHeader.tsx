import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Globe, LogOut, Menu, PanelLeft, Settings, UserRound } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { userDisplay } from "@/auth/userDisplay";
import { ConfirmSignOutModal } from "@/components/admin/ConfirmSignOutModal";
import { NotificationPanel } from "@/components/messaging/NotificationPanel";
import { getAdminPageMeta } from "@/data/adminNav";
import { cn } from "@/lib/cn";
import { useMessaging } from "@/providers/MessagingProvider";

type AdminHeaderProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
};

export function AdminHeader({ collapsed, mobileOpen, onToggleCollapsed, onOpenMobile }: AdminHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const display = user ? userDisplay(user, profile) : { name: "Account", initials: "A", role: "User" };
  const page = getAdminPageMeta(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const notesId = useId();
  const { notifications, unreadNotificationCount, loadStatus, markNotificationRead, markAllNotificationsRead, clearNotifications } =
    useMessaging();

  useEffect(() => {
    setMenuOpen(false);
    setNotesOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !notesOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuOpen && !menuRef.current?.contains(target)) setMenuOpen(false);
      if (notesOpen && !notesRef.current?.contains(target)) setNotesOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotesOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, notesOpen]);

  return (
    <header
      className={cn(
        "pointer-events-auto fixed top-0 right-0 z-20 flex h-[var(--admin-header)] items-center justify-between gap-3 border-b border-[var(--admin-line)] bg-[var(--admin-card)] px-4 lg:px-6",
        "left-0 transition-[left] duration-[var(--duration-base)] ease-[var(--ease-out)]",
        collapsed ? "lg:left-[var(--admin-sidebar-collapsed)]" : "lg:left-[var(--admin-sidebar)]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] lg:hidden"
          aria-label="Open menu"
          aria-controls="admin-sidebar"
          aria-expanded={mobileOpen}
          onClick={onOpenMobile}
        >
          <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hidden size-9 items-center justify-center rounded-lg text-[var(--admin-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)] lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          <PanelLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-[var(--admin-muted)]">Admin</p>
          <p className="truncate font-heading text-base font-semibold tracking-tight text-[var(--admin-ink)]">
            {page.label}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative" ref={notesRef}>
          <button
            type="button"
            className="relative inline-flex size-9 items-center justify-center rounded-lg text-[var(--admin-muted)] transition-colors hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]"
            aria-label={
              unreadNotificationCount ? `${unreadNotificationCount} unread notifications` : "Notifications"
            }
            aria-expanded={notesOpen}
            aria-controls={notesId}
            aria-haspopup="dialog"
            onClick={() => {
              setNotesOpen((value) => !value);
              setMenuOpen(false);
            }}
          >
            <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
            {unreadNotificationCount > 0 ? (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--admin-blue)]" aria-hidden="true" />
            ) : null}
          </button>
          <NotificationPanel
            tone="admin"
            role="admin"
            open={notesOpen}
            id={notesId}
            notifications={notifications}
            loading={loadStatus === "loading"}
            onClose={() => setNotesOpen(false)}
            onOpen={(item) => {
              if (!item.readAt) void markNotificationRead(item.id);
            }}
            onMarkAllRead={() => void markAllNotificationsRead()}
            onClearAll={() => void clearNotifications()}
          />
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left transition-colors hover:bg-[var(--admin-bg)]"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-haspopup="menu"
            onClick={() => {
              setMenuOpen((value) => !value);
              setNotesOpen(false);
            }}
          >
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--admin-navy)] font-heading text-xs font-semibold text-white">
              {display.initials}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block font-heading text-[13px] font-semibold leading-tight text-[var(--admin-ink)]">
                {display.name}
              </span>
              <span className="block text-[11px] leading-tight text-[var(--admin-muted)]">{display.role}</span>
            </span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={cn(
                "hidden text-[var(--admin-muted)] transition-transform duration-[var(--duration-fast)] sm:block",
                menuOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>

          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-lg border border-[var(--admin-line)] bg-[var(--admin-card)] py-1 shadow-[0_12px_32px_rgb(7_17_31_/_0.08)]"
            >
              <Link
                role="menuitem"
                to="/"
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                onClick={() => setMenuOpen(false)}
              >
                <Globe size={15} strokeWidth={1.75} aria-hidden="true" />
                View website
              </Link>
              <Link
                role="menuitem"
                to="/admin/profile"
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                onClick={() => setMenuOpen(false)}
              >
                <UserRound size={15} strokeWidth={1.75} aria-hidden="true" />
                Profile
              </Link>
              {isActiveAdmin(profile) ? (
                <Link
                  role="menuitem"
                  to="/admin/settings"
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings size={15} strokeWidth={1.75} aria-hidden="true" />
                  Settings
                </Link>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmSignOut(true);
                }}
              >
                <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmSignOutModal
        open={confirmSignOut}
        busy={signingOut}
        onClose={() => {
          if (signingOut) return;
          setConfirmSignOut(false);
        }}
        onConfirm={() => {
          if (signingOut) return;
          setSigningOut(true);
          void signOut().then(() => navigate("/login"));
        }}
      />
    </header>
  );
}
