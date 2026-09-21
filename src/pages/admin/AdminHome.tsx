import { useMemo } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { isAccounting, isProjectManager, isSales } from "@/auth/roles";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { AccountingOverview } from "@/pages/admin/AccountingOverview";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { PmOverview } from "@/pages/admin/PmOverview";
import { SalesOverview } from "@/pages/admin/SalesOverview";

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
  if (isSales(profile)) return <SalesOverview />;
  if (isAccounting(profile)) return <AccountingOverview />;
  return <AdminOverview />;
}
