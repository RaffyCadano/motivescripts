import { useAuth } from "@/auth/AuthProvider";
import { isDesigner, isDeveloper } from "@/auth/roles";
import { TeamDashboard } from "@/pages/team/TeamDashboard";
import { TeamDesignerDashboard } from "@/pages/team/TeamDesignerDashboard";
import { TeamDeveloperDashboard } from "@/pages/team/TeamDeveloperDashboard";

/** Mirrors AdminHome.tsx's template-conditional branch, on the Team side. */
export function TeamDashboardHome() {
  const { profile } = useAuth();
  if (isDeveloper(profile)) return <TeamDeveloperDashboard />;
  if (isDesigner(profile)) return <TeamDesignerDashboard />;
  return <TeamDashboard />;
}
