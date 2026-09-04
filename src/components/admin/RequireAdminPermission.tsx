import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { getAdminPageMeta, getRequiredAdminPermission } from "@/data/adminNav";

/**
 * Sidebar nav already hides links a staff member lacks the grant for, but a typed or
 * bookmarked URL would otherwise reach the page anyway and render its normal
 * "no records yet" empty state — indistinguishable from actually having zero records.
 * This blocks that: it enforces the same navPermission map at the route level.
 */
export function RequireAdminPermission() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const required = getRequiredAdminPermission(pathname);

  if (required && !hasPermission(profile, required)) {
    const page = getAdminPageMeta(pathname);
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{page.label}</h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--admin-muted)]">You don’t have access to this section.</p>
        <div className="mt-8 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10 text-sm text-[var(--admin-muted)]">
          Ask an administrator to grant you access if you need this.
        </div>
      </div>
    );
  }

  return <Outlet />;
}
