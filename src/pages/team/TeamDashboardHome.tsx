import { useAuth } from "@/auth/AuthProvider";
import { isContentWriter, isDesigner, isDeveloper, isTeamMember } from "@/auth/roles";
import { TeamContentWriterDashboard } from "@/pages/team/TeamContentWriterDashboard";
import { TeamDashboard } from "@/pages/team/TeamDashboard";
import { TeamDesignerDashboard } from "@/pages/team/TeamDesignerDashboard";
import { TeamDeveloperDashboard } from "@/pages/team/TeamDeveloperDashboard";
import { TeamQaDashboard } from "@/pages/team/TeamQaDashboard";

/** Mirrors AdminHome.tsx's template-conditional branch, on the Team side. */
export function TeamDashboardHome() {
  const { profile } = useAuth();
  if (isDeveloper(profile)) return <TeamDeveloperDashboard />;
  if (isDesigner(profile)) return <TeamDesignerDashboard />;
  if (isContentWriter(profile)) return <TeamContentWriterDashboard />;
  if (isTeamMember(profile)) return <TeamQaDashboard />;
  return <TeamDashboard />;
}
