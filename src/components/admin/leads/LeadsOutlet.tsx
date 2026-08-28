import { Outlet, useLocation } from "react-router-dom";
import { AgencyLoadPanel } from "@/components/admin/leads/AgencyLoadPanel";
import { LeadToast } from "@/components/admin/leads/LeadToast";
import { useLeads } from "@/components/admin/leads/LeadsProvider";

function loadingTitle(pathname: string): string {
  if (pathname.includes("/admin/clients")) return "Loading clients…";
  if (pathname.includes("/admin/messages")) return "Loading messages…";
  if (pathname.includes("/admin/leads")) return "Loading leads…";
  if (pathname.includes("/admin/projects")) return "Loading projects…";
  return "Loading projects…";
}

export function LeadsOutlet() {
  const { pathname } = useLocation();
  const { loadStatus, loadError, reload } = useLeads();

  return (
    <>
      {loadStatus === "ready" ? (
        <Outlet />
      ) : (
        <AgencyLoadPanel
          status={loadStatus}
          error={loadError}
          loadingTitle={loadingTitle(pathname)}
          onRetry={() => void reload()}
        />
      )}
      <LeadToast />
    </>
  );
}
