import { FileText, FolderKanban, RefreshCw, StickyNote, UserCheck, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { ClientStatusBadge } from "@/components/admin/clients/ClientStatusBadge";
import { useClientDeliverables, useClientProjects } from "@/components/admin/leads/LeadsProvider";
import { ProjectStatusBadge } from "@/components/admin/projects/ProjectStatusBadge";
import {
  formatClientDate,
  formatClientSince,
  formatClientTimestamp,
  type AgencyActivityItem,
  type AgencyClient,
} from "@/data/agencyClients";
import { currentVersion, formatFileRelative, recentDeliverables, versionLabel } from "@/data/files";
import { calculateProjectProgress, type AgencyProject } from "@/data/agencyProjects";
import { formatConversationTime } from "@/data/messaging";
import { useMessaging } from "@/providers/MessagingProvider";

const activityIcons = {
  created: UserPlus,
  converted: UserCheck,
  note: StickyNote,
  project: FolderKanban,
  file: FileText,
  status: RefreshCw,
} as const;

export function ClientContactSection({ client }: { client: AgencyClient }) {
  const phoneHref = client.phone !== "—" ? `tel:${client.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <section
      id="contact"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Contact Information</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Item label="Name" value={client.contactName} />
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Email</dt>
          <dd className="mt-1">
            <a className="text-sm font-medium text-[var(--admin-blue)] hover:underline" href={`mailto:${client.email}`}>
              {client.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Phone</dt>
          <dd className="mt-1">
            {phoneHref ? (
              <a className="text-sm font-medium text-[var(--admin-blue)] hover:underline" href={phoneHref}>
                {client.phone}
              </a>
            ) : (
              <span className="text-sm text-[var(--admin-muted)]">Not provided</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ClientBusinessSection({ client, onEdit }: { client: AgencyClient; onEdit: () => void }) {
  return (
    <section
      id="overview"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Business Information</h2>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Item label="Business Name" value={client.businessName} />
        <Item label="Industry" value={client.industry} />
        <div>
          <dt className="text-[12px] text-[var(--admin-muted)]">Website</dt>
          <dd className="mt-1">
            {client.website ? (
              <a
                className="text-sm font-medium text-[var(--admin-blue)] hover:underline"
                href={websiteHref(client.website)}
                target="_blank"
                rel="noreferrer"
              >
                {client.website}
              </a>
            ) : (
              <span className="text-sm text-[var(--admin-muted)]">Not provided</span>
            )}
          </dd>
        </div>
        <Item label="Location" value={client.location || "Not provided"} muted={!client.location} />
        <Item label="Source" value={client.source} />
        <Item label="Client since" value={formatClientSince(client.createdAt)} />
      </dl>
    </section>
  );
}

export function ClientNotesSection({ client, onAddNote }: { client: AgencyClient; onAddNote: () => void }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Internal Notes</h2>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Agency only — never shown in the Client Portal.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          onClick={onAddNote}
        >
          Add Note
        </button>
      </div>
      {client.notes.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No internal notes yet</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {client.notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-[var(--admin-bg)] px-3 py-3">
              <p className="text-sm leading-relaxed text-[var(--admin-ink)]">{note.body}</p>
              <p className="mt-2 text-[12px] text-[var(--admin-muted)]">
                {note.author} · {formatClientTimestamp(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ClientActivitySection({ items }: { items: AgencyActivityItem[] }) {
  const recent = [...items]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);

  return (
    <section
      id="activity"
      className="h-auto scroll-mt-4 self-start rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Activity</h2>
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No activity yet</p>
      ) : (
        <ol className="mt-5 space-y-0">
          {recent.map((item, index) => {
            const Icon = activityIcons[item.icon];
            return (
              <li key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-[var(--admin-hover)] text-[var(--admin-blue)]">
                    <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  {index < recent.length - 1 ? (
                    <span className="w-px flex-1 bg-[var(--admin-line)]" aria-hidden="true" />
                  ) : null}
                </div>
                <div className="pb-5">
                  <p className="text-sm text-[var(--admin-ink)]">{item.description}</p>
                  <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
                    {formatClientDate(item.createdAt)} · {formatClientTimestamp(item.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function ClientProjectsSection({
  client,
  createHref,
}: {
  client: AgencyClient;
  createHref: string;
}) {
  const projects = useClientProjects(client.id);
  return (
    <section
      id="projects"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Projects</h2>
        {projects.length > 0 ? (
          <Link
            to={createHref}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            Create Project
          </Link>
        ) : null}
      </div>
      {projects.length === 0 ? (
        <div className="mt-4">
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">No projects yet</p>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Create a project after the scope form is in, or start one now if you already know the brief.
          </p>
          <Link
            to={createHref}
            className="mt-4 inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          >
            Create Project
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectCard({ project }: { project: AgencyProject }) {
  return (
    <li className="rounded-xl border border-[var(--admin-line)] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{project.name}</p>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{project.type}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <p className="mt-3 text-[12px] text-[var(--admin-muted)]">
        Status: <span className="text-[var(--admin-ink)]">{project.status}</span>
      </p>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">Created: {formatClientSince(project.createdAt)}</p>
      <div className="mt-3">
        <ProgressBar value={calculateProjectProgress(project)} label="Progress" />
      </div>
      <Link
        to={`/admin/projects/${project.id}`}
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-[var(--admin-blue)] px-3 font-heading text-[12px] font-semibold text-white"
      >
        View Project
      </Link>
    </li>
  );
}

export function ClientFilesSection({ client }: { client: AgencyClient }) {
  const deliverables = useClientDeliverables(client.id);
  const files = recentDeliverables(deliverables);
  const filesHref = files[0] ? `/admin/projects/${files[0].projectId}?tab=files` : null;

  return (
    <section
      id="files"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent Files</h2>
        {filesHref ? (
          <Link
            to={filesHref}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            View Files
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center px-3 font-heading text-[12px] font-semibold text-[var(--admin-muted)]">
            View Files
          </span>
        )}
      </div>
      {files.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No project deliverables for this client yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {files.map((item) => {
            const current = currentVersion(item);
            return (
              <li key={item.id}>
                <Link
                  to={`/admin/projects/${item.projectId}?tab=files&file=${item.id}`}
                  className="block hover:text-[var(--admin-blue)]"
                >
                  <p className="text-sm font-medium text-[var(--admin-ink)]">{item.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                    {current ? versionLabel(current.versionNumber) : "No versions"}
                    <span aria-hidden="true"> · </span>
                    {formatFileRelative(item.updatedAt)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ClientMessagesSection({ client }: { client: AgencyClient }) {
  const { conversations } = useMessaging();
  const items = conversations.filter((item) => item.clientId === client.id).slice(0, 5);
  return (
    <section
      id="messages"
      className="scroll-mt-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Messages</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/admin/messages?client=${client.id}&compose=new`}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            New conversation
          </Link>
          <Link
            to={`/admin/messages?client=${client.id}`}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-line)] px-3 font-heading text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
          >
            View messages
          </Link>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--admin-muted)]">No conversations with this client yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/admin/messages/${item.id}`} className="block hover:underline">
                <p className="text-[12px] font-medium text-[var(--admin-ink)]">{item.subject}</p>
                <p className="mt-0.5 text-sm text-[var(--admin-muted)]">
                  {item.lastMessagePreview || "No messages yet"} · {formatConversationTime(item.lastMessageAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Item({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--admin-muted)]">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${muted ? "text-[var(--admin-muted)]" : "text-[var(--admin-ink)]"}`}>
        {value}
      </dd>
    </div>
  );
}

function websiteHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function ClientHeaderMeta({ client }: { client: AgencyClient }) {
  return (
    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-[12px] text-[var(--admin-muted)]">Primary contact</dt>
        <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{client.contactName}</dd>
      </div>
      <div>
        <dt className="text-[12px] text-[var(--admin-muted)]">Industry</dt>
        <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{client.industry}</dd>
      </div>
      <div>
        <dt className="text-[12px] text-[var(--admin-muted)]">Client status</dt>
        <dd className="mt-1">
          <ClientStatusBadge status={client.status} />
        </dd>
      </div>
      <div>
        <dt className="text-[12px] text-[var(--admin-muted)]">Client since</dt>
        <dd className="mt-0.5 font-medium text-[var(--admin-ink)]">{formatClientSince(client.createdAt)}</dd>
      </div>
    </dl>
  );
}
