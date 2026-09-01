import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminBlueBtn, adminGhostBtn } from "@/components/admin/adminActionStyles";
import { AdminAttentionList } from "@/components/admin/list/AdminAttentionList";
import { AdminEmptyState } from "@/components/admin/list/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { ProjectFilters } from "@/components/admin/projects/ProjectFilters";
import { ProjectSummary } from "@/components/admin/projects/ProjectSummary";
import { ProjectTable } from "@/components/admin/projects/ProjectTable";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import type { AgencyClient } from "@/data/agencyClients";
import {
  filterProjects,
  projectListAttention,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";

export function AdminProjects() {
  const { projects, clients } = useLeads();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AgencyProjectStatus | "All">("All");
  const [clientId, setClientId] = useState<string | "All">("All");
  const [type, setType] = useState<AgencyProjectType | "All">("All");

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
  const attention = useMemo(
    () =>
      projects.flatMap((project) => {
        const item = projectListAttention(project);
        return item ? [{ project, body: item.body }] : [];
      }),
    [projects],
  );

  function resetFilters() {
    setQuery("");
    setStatus("All");
    setClientId("All");
    setType("All");
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Projects"
        description="Client work from planning through launch. Create a project after the client is ready to begin."
        action={
          <Link to="/admin/projects/new" className={`${adminBlueBtn} justify-center`}>
            + New Project
          </Link>
        }
      />

      <ProjectSummary selected={status} onSelect={setStatus} />

      <AdminAttentionList
        items={attention.map((item) => ({
          id: item.project.id,
          name: item.project.name,
          body: item.body,
          href: `/admin/projects/${item.project.id}`,
          label: "View",
        }))}
      />

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
        onReset={resetFilters}
      />

      {activeProjects.length === 0 ? (
        <AdminEmptyState
          title="No projects yet"
          body="Create a project after a client is ready to move into project planning."
          action={
            <Link to="/admin/projects/new" className={`${adminBlueBtn} justify-center`}>
              New Project
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <AdminEmptyState
          title="No projects match your filters."
          body="Try a different project name, client, type, or status."
          action={
            searching ? (
              <button type="button" className={`${adminGhostBtn} justify-center`} onClick={resetFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <ProjectTable projects={visible} clientsById={clientsById} />
      )}
    </div>
  );
}
