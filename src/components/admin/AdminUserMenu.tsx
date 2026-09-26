import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type UserMenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Drawn as a blue call to action (the client portal's Plans & Website Care). */
  highlight?: boolean;
};

/** The menu is written with the admin colours; in the client portal it points them at the client ones. */
const CLIENT_LOOK = {
  "--admin-line": "var(--client-line)",
  "--admin-card": "var(--client-card)",
  "--admin-bg": "var(--client-bg)",
  "--admin-ink": "var(--client-ink)",
  "--admin-muted": "var(--client-muted)",
  "--admin-blue": "var(--client-blue)",
  "--admin-navy": "var(--client-navy)",
} as CSSProperties;

/**
 * The dropdown under the avatar in the admin, team and client headers: who is signed in (avatar, name, email and role),
 * the places they can go, then Log out on its own at the bottom.
 */
export function AdminUserMenu({
  id,
  name,
  initials,
  role,
  email,
  items,
  tone = "admin",
  onNavigate,
  onLogOut,
}: {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  items: UserMenuItem[];
  tone?: "admin" | "client";
  /** Called when a link is chosen, so the menu can close. */
  onNavigate: () => void;
  onLogOut: () => void;
}) {
  return (
    <div
      id={id}
      role="menu"
      style={tone === "client" ? CLIENT_LOOK : undefined}
      className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--admin-line)] bg-[var(--admin-card)] shadow-[0_16px_40px_rgb(7_17_31_/_0.12)]"
    >
      <div className="flex items-center gap-3 border-b border-[var(--admin-line)] bg-[var(--admin-bg)] px-4 py-3.5">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-navy)] font-heading text-sm font-semibold text-white"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold leading-tight text-[var(--admin-ink)]">{name}</p>
          {email ? <p className="mt-0.5 truncate text-[12px] leading-tight text-[var(--admin-muted)]">{email}</p> : null}
          <span className="mt-1.5 inline-flex rounded-full bg-[rgb(0_80_240_/_0.08)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[var(--admin-blue)]">
            {role}
          </span>
        </div>
      </div>

      <div className="p-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              role="menuitem"
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                item.highlight
                  ? "bg-[rgb(0_80_240_/_0.06)] font-semibold text-[var(--admin-blue)] hover:bg-[rgb(0_80_240_/_0.1)]"
                  : "text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                  item.highlight
                    ? "bg-[rgb(0_80_240_/_0.12)] text-[var(--admin-blue)]"
                    : "bg-[var(--admin-bg)] text-[var(--admin-muted)] group-hover:bg-[rgb(0_80_240_/_0.1)] group-hover:text-[var(--admin-blue)]",
                )}
              >
                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-[var(--admin-line)] p-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={onLogOut}
          className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#b42318] transition-colors hover:bg-red-50"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-[#b42318] transition-colors group-hover:bg-red-100">
            <LogOut size={15} strokeWidth={1.9} aria-hidden="true" />
          </span>
          Log out
        </button>
      </div>
    </div>
  );
}
