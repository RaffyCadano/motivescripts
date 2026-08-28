import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ClientFollowUpDialog } from "@/components/admin/clients/ClientFollowUpDialog";
import { AddNoteModal } from "@/components/admin/leads/AddNoteModal";
import { ChangeStatusModal } from "@/components/admin/leads/ChangeStatusModal";
import { ConvertLeadModal } from "@/components/admin/leads/ConvertLeadModal";
import { LeadActivity } from "@/components/admin/leads/LeadActivity";
import { LeadContactCard } from "@/components/admin/leads/LeadContactCard";
import { LeadNotes } from "@/components/admin/leads/LeadNotes";
import { LeadProjectRequest } from "@/components/admin/leads/LeadProjectRequest";
import { LeadStatusBadge } from "@/components/admin/leads/LeadStatusBadge";
import { useLead, useLeads } from "@/components/admin/leads/LeadsProvider";

export function AdminLeadDetails() {
  const { id } = useParams();
  const lead = useLead(id);
  const { updateStatus, addNote, convertToClient } = useLeads();
  const [statusOpen, setStatusOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertedId, setConvertedId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/leads" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Leads
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
                {lead.businessName}
              </h1>
              <LeadStatusBadge status={lead.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">{lead.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
            >
              Contact Lead
            </a>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              onClick={() => setStatusOpen(true)}
            >
              Change Status
            </button>
            {lead.convertedClientId ? (
              <>
                <span className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-muted)]">
                  Already converted
                </span>
                <Link
                  to={`/admin/clients/${lead.convertedClientId}`}
                  className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
                >
                  View Client
                </Link>
              </>
            ) : (
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
                onClick={() => setConvertOpen(true)}
              >
                Convert to Client
              </button>
            )}
          </div>
        </div>
      </div>

      {lead.convertedClientId ? (
        <div
          className="rounded-[var(--admin-radius)] border border-[rgb(16_185_129_/_0.25)] bg-[rgb(16_185_129_/_0.08)] px-4 py-3 text-sm text-[var(--admin-ink)]"
          role="status"
        >
          This lead is marked Won and already has a client record.{" "}
          <Link
            className="font-semibold text-[var(--admin-blue)] hover:underline"
            to={`/admin/clients/${lead.convertedClientId}`}
          >
            View Client
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-6">
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
