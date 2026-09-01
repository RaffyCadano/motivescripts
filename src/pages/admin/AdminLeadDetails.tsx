import { useState } from "react";
import { CircleCheck, Mail, RefreshCw, UserPlus, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminBlueBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { ClientFollowUpDialog } from "@/components/admin/clients/ClientFollowUpDialog";
import { AddNoteModal } from "@/components/admin/leads/AddNoteModal";
import { ChangeStatusModal } from "@/components/admin/leads/ChangeStatusModal";
import { ConvertLeadModal } from "@/components/admin/leads/ConvertLeadModal";
import { LeadActivity } from "@/components/admin/leads/LeadActivity";
import { LeadContactCard } from "@/components/admin/leads/LeadContactCard";
import { LeadNextAction } from "@/components/admin/leads/LeadNextAction";
import { LeadNotes } from "@/components/admin/leads/LeadNotes";
import { LeadProjectRequest } from "@/components/admin/leads/LeadProjectRequest";
import { LeadStatusBadge } from "@/components/admin/leads/LeadStatusBadge";
import { LeadWorkflow } from "@/components/admin/leads/LeadWorkflow";
import { useLead, useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatLeadSubmitted } from "@/data/leads";

export function AdminLeadDetails() {
  const { id } = useParams();
  const lead = useLead(id);
  const { profile } = useAuth();
  const { updateStatus, addNote, convertToClient } = useLeads();
  const [statusOpen, setStatusOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertedId, setConvertedId] = useState<string | null>(null);
  const canConvert = hasPermission(profile, "leads.manage");

  if (!lead) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Lead not found</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">That inquiry isn’t in your workspace, or you don’t have access.</p>
        <Link
          to="/admin/leads"
          className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline"
        >
          Back to leads
        </Link>
      </div>
    );
  }

  const converted = Boolean(lead.convertedClientId);
  const leadActions: AdminActionsMenuItem[] = [
    { id: "contact", label: "Contact Lead", icon: Mail, href: `mailto:${lead.email}` },
    { id: "status", label: "Change Status", icon: RefreshCw, onSelect: () => setStatusOpen(true) },
  ];
  if (converted && lead.convertedClientId) {
    leadActions.push(
      { id: "converted", label: "Already converted", icon: CircleCheck, disabled: true },
      {
        id: "view-client",
        label: "View Client",
        icon: Users,
        href: `/admin/clients/${lead.convertedClientId}`,
      },
    );
  } else if (canConvert) {
    leadActions.push({
      id: "convert",
      label: "Convert to Client",
      icon: UserPlus,
      onSelect: () => setConvertOpen(true),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/leads" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Leads
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">{lead.name}</h1>
              <LeadStatusBadge status={lead.status} />
              {converted ? (
                <span className="inline-flex items-center rounded-full bg-[rgb(16_185_129_/_0.1)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[#0f7a56]">
                  Converted
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{lead.businessName}</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              Submitted {formatLeadSubmitted(lead.createdAt)} · {lead.source}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {converted && lead.convertedClientId ? (
              <Link to={`/admin/clients/${lead.convertedClientId}`} className={adminPrimaryBtn}>
                View Client
              </Link>
            ) : canConvert ? (
              <button type="button" className={adminBlueBtn} onClick={() => setConvertOpen(true)}>
                Convert to Client
              </button>
            ) : null}
            <AdminActionsMenu ariaLabel={`Actions for ${lead.businessName}`} items={leadActions} />
          </div>
        </div>
      </div>

      {converted && lead.convertedClientId ? (
        <div
          className="rounded-[var(--admin-radius)] border border-[rgb(16_185_129_/_0.25)] bg-[rgb(16_185_129_/_0.08)] px-4 py-3 text-sm text-[var(--admin-ink)]"
          role="status"
        >
          This lead has been converted to a client.{" "}
          <Link
            className="font-semibold text-[var(--admin-blue)] hover:underline"
            to={`/admin/clients/${lead.convertedClientId}`}
          >
            View Client
          </Link>
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-muted)]">
          Converting creates the client record and moves this relationship into the Client workflow. It does not create a
          project, proposal, or portal account.
        </p>
      )}

      <LeadWorkflow converted={converted} clientId={lead.convertedClientId} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-6">
          <LeadNextAction lead={lead} canConvert={canConvert} onConvert={() => setConvertOpen(true)} />
          <LeadContactCard lead={lead} />
          <LeadProjectRequest lead={lead} />
          <LeadNotes lead={lead} onAddNote={() => setNoteOpen(true)} />
        </div>
        <LeadActivity lead={lead} />
      </div>

      <ChangeStatusModal
        lead={statusOpen ? lead : null}
        onClose={() => setStatusOpen(false)}
        onSave={(status) => {
          updateStatus(lead.id, status);
          setStatusOpen(false);
        }}
      />
      <AddNoteModal
        lead={noteOpen ? lead : null}
        onClose={() => setNoteOpen(false)}
        onSave={(body) => addNote(lead.id, body)}
      />
      <ConvertLeadModal
        lead={convertOpen ? lead : null}
        onClose={() => setConvertOpen(false)}
        onConfirm={async () => {
          const clientId = await convertToClient(lead.id);
          setConvertOpen(false);
          if (clientId) setConvertedId(clientId);
        }}
      />
      <ClientFollowUpDialog
        open={Boolean(convertedId)}
        title="Open the new client?"
        description="This lead is now a client record."
        to={convertedId ? `/admin/clients/${convertedId}` : "/admin/clients"}
        actionLabel="View Client"
        onClose={() => setConvertedId(null)}
      />
    </div>
  );
}
