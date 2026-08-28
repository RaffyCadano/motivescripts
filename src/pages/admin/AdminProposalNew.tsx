import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { createProposal } from "@/data/documentsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminProposalNew() {
  const { clients, projects, notify } = useLeads();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("Website proposal");
  const [busy, setBusy] = useState(false);
  const clientProjects = projects.filter((project) => project.clientId === clientId && !project.archived);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId || busy) return;
    setBusy(true);
    try {
      const id = await createProposal(clientId, projectId || null, title);
      notify("Proposal created.");
      navigate(`/admin/proposals/${id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this proposal.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/proposals" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Proposals
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">New proposal</h1>
      {clients.length === 0 ? (
        <p className="text-sm text-[var(--admin-muted)]">Add a client before creating a proposal.</p>
      ) : (
        <form className="max-w-lg space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold">
            Client
            <select
              required
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setProjectId("");
              }}
              className={inputClass}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Project <span className="font-medium text-[var(--admin-muted)]">(optional)</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputClass}>
              <option value="">No project yet</option>
              {clientProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create draft"}
          </button>
        </form>
      )}
    </div>
  );
}

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";
