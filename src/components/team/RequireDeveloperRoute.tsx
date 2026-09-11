import { Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isDeveloper } from "@/auth/roles";
import { TeamEmptyState } from "@/components/team/TeamEmptyState";

/**
 * /team/qa-review, /team/needs-changes, /team/blocked, and /team/deployments
 * are only ever linked from the Developer nav (filterTeamNavGroups switches
 * to developerNavGroups for isDeveloper(profile) -- see data/teamNav.ts).
 * The data behind them was always correctly scoped to the viewer's own
 * assignments via RLS, but nothing stopped a Designer/Content Writer/Team
 * Member from reaching them by a typed or bookmarked URL. This enforces the
 * same intent at the route level -- nav hiding was never the real boundary,
 * this is just closing the gap between "not linked" and "not reachable."
 * Admins keep full access, matching the rest of the agency workspace.
 */
export function RequireDeveloperRoute() {
  const { profile } = useAuth();

  if (!isDeveloper(profile) && profile?.role !== "admin") {
    return (
      <TeamEmptyState
        title="Developer workspace"
        body="This page is part of the Developer workspace. Ask an admin if you need access."
      />
    );
  }

  return <Outlet />;
}
