import { useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isProjectManager } from "@/auth/roles";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { PmOverview } from "@/pages/admin/PmOverview";

export function AdminHome() {
  const { profile } = useAuth();
  const team = useTeamDirectory();

  const self = useMemo(
    () => team.data?.members.find((member) => member.id === profile?.id) ?? null,
    [profile?.id, team.data?.members],
  );

  const showPmDashboard = useMemo(() => {
    if (!profile) return false;
    if (isProjectManager(profile)) return true;
    return self?.templateKey === "project_manager";
  }, [profile, self?.templateKey]);

  if (showPmDashboard) return <PmOverview />;
  return <AdminOverview />;
}
