import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { ScopeFormPage } from "@/pages/client/ClientScope";

/** The scope form is written with the client portal's colours; this points them at the admin's, so it looks like the rest of the admin. */
const ADMIN_LOOK = {
  "--client-bg": "var(--admin-bg)",
  "--client-ink": "var(--admin-ink)",
  "--client-muted": "var(--admin-muted)",
  "--client-card": "var(--admin-card)",
  "--client-line": "var(--admin-line)",
  "--client-hover": "var(--admin-hover)",
  "--client-blue": "var(--admin-blue)",
  "--client-bright": "var(--admin-bright)",
  "--client-navy": "var(--admin-navy)",
  "--client-radius": "var(--admin-radius)",
} as CSSProperties;

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
        <div className="client-theme max-w-3xl" style={ADMIN_LOOK}>
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
