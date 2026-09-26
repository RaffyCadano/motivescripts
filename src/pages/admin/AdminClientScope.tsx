import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { ADMIN_LOOK } from "@/components/settings/adminLook";
import { ScopeFormPage } from "@/pages/client/ClientScope";

/**
 * Staff fill in a client's Website Scope for them (a client who has not done it, or a brief taken over the phone).
 * It is the same form and the same scope record the client sees in their portal, worded for staff and in the
 * admin look.
 */
export function AdminClientScope() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const { clients } = useLeads();
  const client = clients.find((item) => item.id === id);

  return (
    <div className="space-y-5">
      <Link to={client ? `/admin/clients/${client.id}` : "/admin/clients"} className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        {client ? client.businessName : "Clients"}
      </Link>
      <AdminPageHeader
        title="Website Scope"
        description={client ? `Fill in the scope for ${client.businessName}.` : "Fill in a client's Website Scope."}
      />
      {!hasPermission(profile, "clients.manage") ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to edit a client’s scope.</p>
      ) : !client ? (
        <p className="text-sm text-[var(--admin-muted)]">That client could not be found.</p>
      ) : (
        <div className="client-theme w-full" style={ADMIN_LOOK}>
          <ScopeFormPage
            client={client}
            staff
            staffActions={
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/admin/projects/new?client=${client.id}`} className={adminBlueBtn}>
                  Create project for this client
                </Link>
                <Link to={`/admin/clients/${client.id}`} className={adminGhostBtn}>
                  Back to client
                </Link>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
