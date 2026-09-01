import { Link } from "react-router-dom";
import { ClientStatusBadge } from "@/components/admin/clients/ClientStatusBadge";
import { ClientWorkflowBadge } from "@/components/admin/clients/ClientWorkflowBadge";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatClientDate, projectCountLabel, type AgencyClient } from "@/data/agencyClients";
import {
  clientListNextAction,
  clientListProjects,
  clientProjectSummary,
  featuredClientProject,
  workflowStageForClient,
  type ClientListRecords,
} from "@/data/clientList";
import { findPrimaryConversation, type ConversationSummary } from "@/data/messaging";

type ClientTableProps = {
  clients: AgencyClient[];
  records: ClientListRecords;
  conversations: ConversationSummary[];
  canViewProjects: boolean;
  canViewMessages: boolean;
  canCreateProposal?: boolean;
};

export function ClientTable({
  clients,
  records,
  conversations,
  canViewProjects,
  canViewMessages,
  canCreateProposal = false,
}: ClientTableProps) {
  const { projects } = useLeads();
  if (clients.length === 0) return null;

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] md:block">
        <table className="w-full min-w-[64rem] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--admin-line)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-muted)]">
              <th className="px-5 py-3 font-semibold">Business</th>
              <th className="px-5 py-3 font-semibold">Contact</th>
              <th className="px-5 py-3 font-semibold">Industry</th>
              <th className="px-5 py-3 font-semibold">Projects</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Workflow</th>
              <th className="px-5 py-3 font-semibold">Last Activity</th>
              <th className="px-5 py-3 font-semibold">Next</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const clientProjects = clientListProjects(projects, client.id);
              const featured = featuredClientProject(clientProjects);
              const next = clientListNextAction(client.id, projects, records, {
                canCreateProposal,
                canViewProjects,
              });
              const conversation = canViewMessages
                ? findPrimaryConversation(conversations, { clientId: client.id })
                : null;
              return (
                <tr key={client.id} className="border-b border-[var(--admin-line)] last:border-b-0 hover:bg-[var(--admin-bg)]">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/admin/clients/${client.id}`}
                      className="font-heading font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                    >
                      {client.businessName}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">{client.contactName}</td>
                  <td className="px-5 py-3.5">{client.industry}</td>
                  <td className="px-5 py-3.5">
                    <ProjectCell
                      count={clientProjects.length}
                      featured={featured}
                      canView={canViewProjects}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <ClientStatusBadge status={client.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <ClientWorkflowBadge stage={workflowStageForClient(client.id, projects, records)} />
                  </td>
                  <td className="px-5 py-3.5 text-[var(--admin-muted)]">{formatClientDate(client.lastActivityAt)}</td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={next.href}
                      className="font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                    >
                      {next.label}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        to={`/admin/clients/${client.id}`}
                        className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline"
                      >
                        View
                      </Link>
                      {canViewProjects && featured ? (
                        <Link
                          to={`/admin/projects/${featured.id}`}
                          className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          Open Project
                        </Link>
                      ) : null}
                      {conversation ? (
                        <Link
                          to={`/admin/messages/${conversation.id}`}
                          className="font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          Open Conversation
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {clients.map((client) => {
          const clientProjects = clientListProjects(projects, client.id);
          const featured = featuredClientProject(clientProjects);
          const next = clientListNextAction(client.id, projects, records, {
            canCreateProposal,
            canViewProjects,
          });
          const conversation = canViewMessages
            ? findPrimaryConversation(conversations, { clientId: client.id })
            : null;
          return (
            <li
              key={client.id}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/admin/clients/${client.id}`}
                    className="font-heading text-sm font-semibold text-[var(--admin-ink)] hover:text-[var(--admin-blue)]"
                  >
                    {client.businessName}
                  </Link>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{client.contactName}</p>
                  <p className="text-[12px] text-[var(--admin-muted)]">{client.industry}</p>
                </div>
                <span className="flex flex-col items-end gap-1.5">
                  <ClientStatusBadge status={client.status} />
                  <ClientWorkflowBadge stage={workflowStageForClient(client.id, projects, records)} />
                </span>
              </div>
              <div className="mt-3">
                <ProjectCell count={clientProjects.length} featured={featured} canView={canViewProjects} />
              </div>
              <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                Last activity: {formatClientDate(client.lastActivityAt)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={next.href}
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
                >
                  {next.label}
                </Link>
                {next.href !== `/admin/clients/${client.id}` ? (
                  <Link
                    to={`/admin/clients/${client.id}`}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                  >
                    View
                  </Link>
                ) : null}
                {canViewProjects && featured ? (
                  <Link
                    to={`/admin/projects/${featured.id}`}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                  >
                    Open Project
                  </Link>
                ) : null}
                {conversation ? (
                  <Link
                    to={`/admin/messages/${conversation.id}`}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)]"
                  >
                    Open Conversation
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ProjectCell({
  count,
  featured,
  canView,
}: {
  count: number;
  featured: ReturnType<typeof featuredClientProject>;
  canView: boolean;
}) {
  if (count === 0) {
    return <span className="text-[var(--admin-muted)]">{projectCountLabel(0)}</span>;
  }

  return (
    <div>
      <p className="text-[var(--admin-ink)]">{projectCountLabel(count)}</p>
      {featured ? (
        <>
          {canView ? (
            <Link
              to={`/admin/projects/${featured.id}`}
              className="mt-0.5 block font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
            >
              {featured.name}
            </Link>
          ) : (
            <p className="mt-0.5 text-[12px] text-[var(--admin-ink)]">{featured.name}</p>
          )}
          <p className="text-[12px] text-[var(--admin-muted)]">{clientProjectSummary(featured)}</p>
        </>
      ) : null}
    </div>
  );
}
