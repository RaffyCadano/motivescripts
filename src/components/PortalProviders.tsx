import { Outlet } from "react-router-dom";
import { LeadsProvider } from "@/components/admin/leads/LeadsProvider";
import { MessagingProvider } from "@/providers/MessagingProvider";

/**
 * The data providers the signed-in areas (admin, team, client) share. They used to wrap the whole app, so every
 * visitor to the public site downloaded and ran them. Now they mount only when one of those areas is opened.
 */
export function PortalProviders() {
  return (
    <LeadsProvider>
      <MessagingProvider>
        <Outlet />
      </MessagingProvider>
    </LeadsProvider>
  );
}
