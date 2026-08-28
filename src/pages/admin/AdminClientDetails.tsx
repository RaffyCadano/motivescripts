import { useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { ClientFollowUpDialog } from "@/components/admin/clients/ClientFollowUpDialog";
import { ClientFormModal } from "@/components/admin/clients/ClientFormModal";
import { ClientNoteModal } from "@/components/admin/clients/ClientNoteModal";
import { ProjectFormModal } from "@/components/admin/projects/ProjectFormModal";
import {
  ClientActivitySection,
  ClientBusinessSection,
  ClientContactSection,
  ClientFilesSection,
  ClientHeaderMeta,
  ClientMessagesSection,
  ClientNotesSection,
  ClientProjectsSection,
} from "@/components/admin/clients/ClientProfileSections";
import { ClientPortalAccountSection } from "@/components/admin/clients/ClientPortalAccountSection";
import { ClientDocumentsSection } from "@/components/admin/clients/ClientDocumentsSection";
import { ClientInvoicesSection } from "@/components/admin/clients/ClientInvoicesSection";
import { StaffAssignmentCard } from "@/components/admin/team/StaffAssignmentCard";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { ClientStatusBadge } from "@/components/admin/clients/ClientStatusBadge";
import { ConfirmClientStatusModal } from "@/components/admin/clients/ConfirmClientStatusModal";
import { useAgencyClient, useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import type { AgencyClientEdits, AgencyClientStatus } from "@/data/agencyClients";

const tabs = [
  { href: "#overview", label: "Overview" },
  { href: "#projects", label: "Projects" },
  { href: "#agreements", label: "Agreements" },
  { href: "#files", label: "Files" },
  { href: "#invoices", label: "Invoices" },
  { href: "#messages", label: "Messages" },
  { href: "#activity", label: "Activity" },
] as const;

export function AdminClientDetails() {
  const { id } = useParams();
  const client = useAgencyClient(id);
  const { clients, updateClient, addClientNote, addProject, setClientStatus, portalAccounts } = useLeads();
  const { profile } = useAuth();
  const team = useTeamDirectory();
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<AgencyClientStatus | null>(null);

  if (!client) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Client not found</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">That client isn’t in your workspace, or you don’t have access.</p>
        <Link
          to="/admin/clients"
          className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline"
        >
          Back to clients
        </Link>
      </div>
    );
  }

  const statusLabel = client.status === "Active" ? "Active Client" : `${client.status} Client`;
  const portalLinked = portalAccounts.some((account) => account.clientId === client.id && account.role === "client");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/clients" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Clients
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
                {client.businessName}
              </h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">{statusLabel}</p>
            <ClientHeaderMeta client={client} />
          </div>
          <div className="flex flex-wrap gap-2">
            {!portalLinked && isActiveAdmin(profile) ? (
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
                onClick={() => setInviteOpen(true)}
              >
                Invite Client
              </button>
            ) : null}
            {hasPermission(profile, "clients.manage") ? (
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              onClick={() => setEditOpen(true)}
            >
              Edit Client
            </button>
            ) : null}
            {hasPermission(profile, "projects.manage") ? (
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white"
                onClick={() => setProjectOpen(true)}
              >
                Create Project
              </button>
            ) : null}
            {hasPermission(profile, "clients.manage") ? (
              <ClientMoreMenu
                status={client.status}
                businessName={client.businessName}
                onRequestStatus={setPendingStatus}
              />
            ) : null}
          </div>
        </div>
      </div>

      <nav aria-label="Client sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 font-heading text-[12px] font-semibold text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] hover:bg-[var(--admin-hover)]"
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-6">
          <ClientContactSection client={client} />
          {team.data ? (
            <StaffAssignmentCard
              kind="client"
              entityId={client.id}
              members={team.data.members}
              assignedUserIds={team.data.members
                .filter((member) => member.clientAssignments.some((item) => item.entityId === client.id))
                .map((member) => member.id)}
              assignedLabels={Object.fromEntries(
                team.data.members.flatMap((member) =>
                  member.clientAssignments
                    .filter((item) => item.entityId === client.id)
                    .map((item) => [member.id, item.label]),
                ),
              )}
              onChanged={() => void team.reload()}
            />
          ) : null}
          <ClientPortalAccountSection
            client={client}
            inviteOpen={inviteOpen}
            onInviteOpenChange={setInviteOpen}
          />
          <ClientBusinessSection client={client} onEdit={() => setEditOpen(true)} />
          <ClientProjectsSection client={client} onCreateProject={() => setProjectOpen(true)} />
          <ClientDocumentsSection client={client} />
          <ClientFilesSection client={client} />
          <ClientInvoicesSection client={client} />
          <ClientMessagesSection client={client} />
          <ClientNotesSection client={client} onAddNote={() => setNoteOpen(true)} />
        </div>
        <ClientActivitySection items={client.activity} />
      </div>

      <ClientFormModal
        mode="edit"
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSubmit={(values) => updateClient(client.id, values as AgencyClientEdits)}
      />
      <ClientNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={(body) => addClientNote(client.id, body)} />
      <ProjectFormModal
        mode="add"
        open={projectOpen}
        clients={clients}
        lockClientId={client.id}
        onClose={() => setProjectOpen(false)}
        onSubmit={async (draft) => {
          const projectId = await addProject({ ...draft, clientId: client.id });
          if (projectId) setCreatedProjectId(projectId);
        }}
      />
      <ClientFollowUpDialog
        open={Boolean(createdProjectId)}
        title="Open this project?"
        description="The project uses the same workspace as Project Management."
        to={createdProjectId ? `/admin/projects/${createdProjectId}` : "/admin/clients"}
        actionLabel="View Project"
        onClose={() => setCreatedProjectId(null)}
      />
      <ConfirmClientStatusModal
        client={pendingStatus ? client : null}
        nextStatus={pendingStatus}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => {
          if (pendingStatus) setClientStatus(client.id, pendingStatus);
          setPendingStatus(null);
        }}
      />
    </div>
  );
}

function ClientMoreMenu({
  status,
  businessName,
  onRequestStatus,
}: {
  status: AgencyClientStatus;
  businessName: string;
  onRequestStatus: (status: AgencyClientStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const actions =
    status === "Active"
      ? [
          { label: "Mark Inactive", next: "Inactive" as const },
          { label: "Archive Client", next: "Archived" as const },
        ]
      : status === "Inactive"
        ? [
            { label: "Reactivate", next: "Active" as const },
            { label: "Archive Client", next: "Archived" as const },
          ]
        : [{ label: "Reactivate", next: "Active" as const }];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-3 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
        aria-label={`More actions for ${businessName}`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        More
        <MoreHorizontal size={16} strokeWidth={1.75} className="ml-2" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--admin-line)] bg-white py-1 shadow-[0_12px_32px_rgb(7_17_31_/_0.08)]"
        >
          {actions.map((action) => (
            <button
              key={action.next}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[13px] text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
              onClick={() => {
                setOpen(false);
                onRequestStatus(action.next);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
