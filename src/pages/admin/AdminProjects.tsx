import { useMemo, useState } from "react";
import { ClientFollowUpDialog } from "@/components/admin/clients/ClientFollowUpDialog";
import { ProjectFilters } from "@/components/admin/projects/ProjectFilters";
import { ProjectFormModal } from "@/components/admin/projects/ProjectFormModal";
import { ProjectSummary } from "@/components/admin/projects/ProjectSummary";
import { ProjectTable } from "@/components/admin/projects/ProjectTable";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyClient } from "@/data/agencyClients";
import {
  filterProjects,
  type AgencyProjectDraft,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";

export function AdminProjects() {
  const { projects, clients, addProject } = useLeads();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AgencyProjectStatus | "All">("All");
  const [clientId, setClientId] = useState<string | "All">("All");
  const [type, setType] = useState<AgencyProjectType | "All">("All");
  const [addOpen, setAddOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const clientsById = useMemo(() => {
    const map = new Map<string, AgencyClient>();
    clients.forEach((client) => map.set(client.id, client));
    return map;
  }, [clients]);

  const visible = useMemo(
    () => filterProjects(projects, clientsById, query, status, clientId, type),
    [clientId, clientsById, projects, query, status, type],
  );
  const searching = query.trim().length > 0 || status !== "All" || clientId !== "All" || type !== "All";
  const activeProjects = projects.filter((project) => !project.archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Projects</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">Manage active client work from planning to launch.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white hover:bg-[var(--admin-bright)]"
          onClick={() => setAddOpen(true)}
        >
          + New Project
        </button>
      </div>

      <ProjectSummary />
      <ProjectFilters
        query={query}
        status={status}
        clientId={clientId}
        type={type}
        clients={clients}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onClientChange={setClientId}
        onTypeChange={setType}
      />

      {activeProjects.length === 0 ? (
        <Empty title="No projects yet" body="Create a project to start managing client work." />
      ) : visible.length === 0 ? (
        <Empty
          title="No projects match your search."
          body={searching ? "Try a different name, client, type, or filter." : "No projects to show."}
        />
      ) : (
        <ProjectTable projects={visible} clientsById={clientsById} />
      )}

      <ProjectFormModal
        mode="add"
        open={addOpen}
        clients={clients}
        onClose={() => setAddOpen(false)}
        onSubmit={async (draft: AgencyProjectDraft) => {
          const id = await addProject(draft);
          if (id) setCreatedId(id);
        }}
      />
      <ClientFollowUpDialog
        open={Boolean(createdId)}
        title="Open this project?"
        description="The project was saved."
        to={createdId ? `/admin/projects/${createdId}` : "/admin/projects"}
        actionLabel="View Project"
        onClose={() => setCreatedId(null)}
      />
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10">
      <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--admin-muted)]">{body}</p>
    </div>
  );
}
