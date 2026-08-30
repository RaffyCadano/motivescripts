import { useState } from "react";
import { Archive, CircleOff, FolderKanban, PencilLine, RotateCcw, UserPlus } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { ClientFormModal } from "@/components/admin/clients/ClientFormModal";
import { ClientNoteModal } from "@/components/admin/clients/ClientNoteModal";
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
import type { AgencyClientStatus } from "@/data/agencyClients";
import { cn } from "@/lib/cn";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "agreements", label: "Agreements" },
  { id: "files", label: "Files" },
  { id: "invoices", label: "Invoices" },
  { id: "messages", label: "Messages" },
  { id: "activity", label: "Activity" },
] as const;

type ClientTab = (typeof tabs)[number]["id"];

function isClientTab(value: string): value is ClientTab {
  return tabs.some((tab) => tab.id === value);
}

export function AdminClientDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useAgencyClient(id);
  const hash = location.hash.replace(/^#/, "");
  const tab: ClientTab = isClientTab(hash) ? hash : "overview";
  const { updateClient, addClientNote, setClientStatus, portalAccounts } = useLeads();
  const { profile } = useAuth();
  const team = useTeamDirectory();
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
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
  const canManageClient = hasPermission(profile, "clients.manage");
  const canManageProjects = hasPermission(profile, "projects.manage");
  const clientActions: AdminActionsMenuItem[] = [];
  if (!portalLinked && isActiveAdmin(profile)) {
    clientActions.push({
      id: "invite",
      label: "Invite Client",
      icon: UserPlus,
      onSelect: () => {
        setInviteOpen(true);
        if (tab !== "overview") {
          navigate({ pathname: location.pathname, hash: "overview" }, { replace: true });
        }
      },
    });
  }
  if (canManageClient) {
    clientActions.push({
      id: "edit",
      label: "Edit Client",
      icon: PencilLine,
      onSelect: () => setEditOpen(true),
    });
  }
  if (canManageProjects) {
    clientActions.push({
      id: "create-project",
      label: "Create Project",
      icon: FolderKanban,
      href: `/admin/projects/new?client=${client.id}`,
    });
  }
  if (canManageClient) {
    if (client.status === "Active") {
      clientActions.push({
        id: "inactive",
        label: "Mark Inactive",
        icon: CircleOff,
        onSelect: () => setPendingStatus("Inactive"),
      });
    } else {
      clientActions.push({
        id: "reactivate",
        label: "Reactivate",
        icon: RotateCcw,
        onSelect: () => setPendingStatus("Active"),
      });
    }
    if (client.status !== "Archived") {
      clientActions.push({
        id: "archive",
        label: "Archive Client",
        icon: Archive,
        danger: true,
        separatorBefore: true,
        onSelect: () => setPendingStatus("Archived"),
      });
    }
  }

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
          <AdminActionsMenu ariaLabel={`Actions for ${client.businessName}`} items={clientActions} />
        </div>
      </div>

      <nav aria-label="Client sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((item) => {
          const active = item.id === tab;
          return (
            <Link
              key={item.id}
              to={{ pathname: location.pathname, hash: item.id }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 font-heading text-[12px] font-semibold",
                active
                  ? "bg-[var(--admin-navy)] text-white"
                  : "bg-white text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] hover:bg-[var(--admin-hover)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-6">
        {tab === "overview" ? (
          <>
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
            <ClientNotesSection client={client} onAddNote={() => setNoteOpen(true)} />
          </>
        ) : null}
        {tab === "projects" ? (
          <ClientProjectsSection client={client} createHref={`/admin/projects/new?client=${client.id}`} />
        ) : null}
        {tab === "agreements" ? <ClientDocumentsSection client={client} /> : null}
        {tab === "files" ? <ClientFilesSection client={client} /> : null}
        {tab === "invoices" ? <ClientInvoicesSection client={client} /> : null}
        {tab === "messages" ? <ClientMessagesSection client={client} /> : null}
        {tab === "activity" ? <ClientActivitySection items={client.activity} /> : null}
      </div>

      <ClientFormModal
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSubmit={(values) => updateClient(client.id, values)}
      />
      <ClientNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={(body) => addClientNote(client.id, body)} />
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
