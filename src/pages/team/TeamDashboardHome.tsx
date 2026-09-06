import { useAuth } from "@/auth/AuthProvider";
import { isDeveloper } from "@/auth/roles";
import { TeamDashboard } from "@/pages/team/TeamDashboard";
import { TeamDeveloperDashboard } from "@/pages/team/TeamDeveloperDashboard";

/** Mirrors AdminHome.tsx's template-conditional branch, on the Team side. */
export function TeamDashboardHome() {
  const { profile } = useAuth();
  return isDeveloper(profile) ? <TeamDeveloperDashboard /> : <TeamDashboard />;
}
