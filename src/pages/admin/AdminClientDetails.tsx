import { useState } from "react";
import {
  Activity,
  Archive,
  CircleOff,
  FileSignature,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Paperclip,
  PencilLine,
  Receipt,
  RotateCcw,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AdminActionsMenu, type AdminActionsMenuItem } from "@/components/admin/AdminActionsMenu";
import { ClientFormModal } from "@/components/admin/clients/ClientFormModal";
import { ClientNoteModal } from "@/components/admin/clients/ClientNoteModal";
import {
  ClientActivitySection,
  ClientFilesSection,
  ClientHeaderMeta,
  ClientMessagesSection,
  ClientProjectsSection,
} from "@/components/admin/clients/ClientProfileSections";
import { ClientOperationsOverview } from "@/components/admin/clients/ClientOperationsOverview";
import { InviteClientDialog } from "@/components/admin/clients/InviteClientDialog";
import { ClientDocumentsSection } from "@/components/admin/clients/ClientDocumentsSection";
import { ClientInvoicesSection } from "@/components/admin/clients/ClientInvoicesSection";
import { ClientRecurringPlansSection } from "@/components/admin/clients/ClientRecurringPlansSection";
import { ClientStatusBadge } from "@/components/admin/clients/ClientStatusBadge";
import { ConfirmClientStatusModal } from "@/components/admin/clients/ConfirmClientStatusModal";
import { useAgencyClient, useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import type { AgencyClient, AgencyClientStatus } from "@/data/agencyClients";
import { cn } from "@/lib/cn";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "agreements", label: "Agreements", icon: FileSignature },
  { id: "files", label: "Files", icon: Paperclip },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "plans", label: "Plans", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "activity", label: "Activity", icon: Activity },
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

      <label className="block text-sm font-semibold text-[var(--admin-ink)] lg:hidden">
        Section
        <select
          value={tab}
          onChange={(event) => {
            if (isClientTab(event.target.value)) {
              navigate({ pathname: location.pathname, hash: event.target.value }, { replace: true });
            }
          }}
          className="mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]"
        >
          {tabs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <nav
          aria-label="Client sections"
          className="hidden rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-3 lg:sticky lg:top-0 lg:block lg:self-start"
        >
          <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
            Sections
          </p>
          <div className="flex flex-col gap-0.5">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = item.id === tab;
              return (
                <Link
                  key={item.id}
                  to={{ pathname: location.pathname, hash: item.id }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium tracking-tight",
                    active
                      ? "bg-[var(--admin-hover)] text-[var(--admin-blue)]"
                      : "text-[var(--admin-ink)]/75 hover:bg-[var(--admin-bg)] hover:text-[var(--admin-ink)]",
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className={active ? "text-[var(--admin-blue)]" : "text-[var(--admin-muted)]"}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          {tab === "overview" ? (
            <ClientOverviewTab
              client={client}
              canManageProjects={canManageProjects}
              onInvite={() => setInviteOpen(true)}
              onAddNote={() => setNoteOpen(true)}
            />
          ) : null}
          {tab === "projects" ? (
            <ClientProjectsSection client={client} createHref={`/admin/projects/new?client=${client.id}`} />
          ) : null}
          {tab === "agreements" ? <ClientDocumentsSection client={client} /> : null}
          {tab === "files" ? <ClientFilesSection client={client} /> : null}
          {tab === "invoices" ? <ClientInvoicesSection client={client} /> : null}
          {tab === "plans" ? <ClientRecurringPlansSection client={client} /> : null}
          {tab === "messages" ? <ClientMessagesSection client={client} /> : null}
          {tab === "activity" ? <ClientActivitySection items={client.activity} /> : null}
        </div>
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
      <InviteClientDialog
        client={client}
        open={inviteOpen}
        mode="send"
        onClose={() => setInviteOpen(false)}
        onSent={() => setInviteOpen(false)}
      />
    </div>
  );
}

function ClientOverviewTab({
  client,
  canManageProjects,
  onInvite,
  onAddNote,
}: {
  client: AgencyClient;
  canManageProjects: boolean;
  onInvite: () => void;
  onAddNote: () => void;
}) {
  return (
    <ClientOperationsOverview
      client={client}
      canManageProjects={canManageProjects}
      createHref={`/admin/projects/new?client=${client.id}`}
      onInvite={onInvite}
      onAddNote={onAddNote}
    />
  );
}
