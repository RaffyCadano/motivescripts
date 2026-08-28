import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Globe, LogOut, Menu, PanelLeft } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ClientConfirmDialog } from "@/components/client/ClientConfirmDialog";
import { NotificationPanel } from "@/components/messaging/NotificationPanel";
import { usePortalIdentity } from "@/components/admin/leads/LeadsProvider";
import { getClientPageMeta } from "@/data/clientNav";
import { cn } from "@/lib/cn";
import { useMessaging } from "@/providers/MessagingProvider";

type ClientHeaderProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
};

export function ClientHeader({ collapsed, mobileOpen, onToggleCollapsed, onOpenMobile }: ClientHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const page = getClientPageMeta(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const notesId = useId();
  const identity = usePortalIdentity();
  const { notifications, unreadNotificationCount, loadStatus, markNotificationRead, markAllNotificationsRead } =
    useMessaging();
  const unread = unreadNotificationCount;

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
    <header className="sticky top-0 z-20 flex h-[var(--client-header)] shrink-0 items-center justify-between gap-3 border-b border-[var(--client-line)] bg-[var(--client-card)] px-4 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--client-ink)] hover:bg-[var(--client-bg)] lg:hidden"
          aria-label="Open menu"
          aria-controls="client-sidebar"
          aria-expanded={mobileOpen}
          onClick={onOpenMobile}
        >
          <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hidden size-10 items-center justify-center rounded-xl text-[var(--client-muted)] hover:bg-[var(--client-bg)] hover:text-[var(--client-ink)] lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-controls="client-sidebar"
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          <PanelLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-[var(--client-muted)]">Client Portal</p>
          <p className="truncate font-heading text-base font-semibold tracking-tight text-[var(--client-ink)]">
            {page.label}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative" ref={notesRef}>
          <button
            type="button"
            className="relative inline-flex size-10 items-center justify-center rounded-xl text-[var(--client-muted)] transition-colors hover:bg-[var(--client-bg)] hover:text-[var(--client-ink)]"
            aria-label={unread ? `${unread} unread notifications` : "Notifications"}
            aria-expanded={notesOpen}
            aria-controls={notesId}
            aria-haspopup="dialog"
            onClick={() => {
              setNotesOpen((value) => !value);
              setMenuOpen(false);
            }}
          >
            <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
            {unread > 0 ? (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--client-blue)]" aria-hidden="true" />
            ) : null}
          </button>
          <NotificationPanel
            tone="client"
            role="client"
            open={notesOpen}
            id={notesId}
            notifications={notifications}
            loading={loadStatus === "loading"}
            onClose={() => setNotesOpen(false)}
            onOpen={(item) => {
              if (!item.readAt) void markNotificationRead(item.id);
            }}
            onMarkAllRead={() => void markAllNotificationsRead()}
          />
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 text-left transition-colors hover:bg-[var(--client-bg)]"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-haspopup="menu"
            onClick={() => {
              setMenuOpen((value) => !value);
              setNotesOpen(false);
            }}
          >
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--client-navy)] font-heading text-xs font-semibold text-white">
              {identity.initials}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block font-heading text-[13px] font-semibold leading-tight text-[var(--client-ink)]">
                {identity.name}
              </span>
              <span className="block text-[11px] leading-tight text-[var(--client-muted)]">
                {identity.businessName}
              </span>
            </span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={cn(
                "hidden text-[var(--client-muted)] transition-transform duration-[var(--duration-fast)] sm:block",
                menuOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>

          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-[var(--client-line)] bg-[var(--client-card)] py-1 shadow-[0_12px_32px_rgb(7_17_31_/_0.08)]"
            >
              <Link
                role="menuitem"
                to="/"
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
                onClick={() => setMenuOpen(false)}
              >
                <Globe size={15} strokeWidth={1.75} aria-hidden="true" />
                View website
              </Link>
              <Link
                role="menuitem"
                to="/client/settings"
                className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
                onClick={() => setMenuOpen(false)}
              >
                Account settings
              </Link>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--client-ink)] hover:bg-[var(--client-bg)]"
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

      <ClientConfirmDialog
        open={confirmSignOut}
        title="Log out?"
        body="You’ll need a new sign-in link to get back into the client portal."
        confirmLabel="Log out"
        busy={signingOut}
        busyLabel="Signing out…"
        onCancel={() => {
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
